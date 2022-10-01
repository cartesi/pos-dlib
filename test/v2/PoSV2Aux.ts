// Copyright 2022 Cartesi Pte. Ltd.

// Licensed under the Apache License, Version 2.0 (the "License"); you may not use
// this file except in compliance with the License. You may obtain a copy of the
// License at http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software distributed
// under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
// CONDITIONS OF ANY KIND, either express or implied. See the License for the
// specific language governing permissions and limitations under the License.

import { expect, use } from "chai";
import { deployments, ethers } from "hardhat";
import {
    deployMockContract,
    MockContract,
} from "@ethereum-waffle/mock-contract";
import { JsonRpcProvider } from "@ethersproject/providers";
import { solidity } from "ethereum-waffle";
import { BigNumber, BigNumberish, Signer } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import {
    BlockSelectorV2,
    BlockSelectorV2__factory,
    PoSV2Aux,
    PoSV2Aux__factory,
    RewardManagerV2Impl,
    RewardManagerV2Impl__factory,
} from "../../src/types";

import { advanceBlock, advanceMultipleBlocks } from "../utils";

use(solidity);

describe("PoSV2Aux", async () => {
    let provider: JsonRpcProvider;
    let signer: Signer;
    let alice: Signer;

    let aliceAddress: string;

    let mockSI: MockContract; //mock staking implementation
    let mockWM: MockContract; //mock worker manager
    let mockCTSI: MockContract; //mock ctsi
    let mockPoS: MockContract; // mock pos
    let minDiff = 100;
    let initialDiff = 100;
    let diffAdjust = 1;
    let targetInterval = 138;

    // RewardManager constructor parameters
    let rewardValue = 1000;
    let rewardDelay = 0;

    const _1e18 = BigNumber.from(10).pow(18);
    const mainnetDifficulty = BigNumber.from("25798284791319440457930"); //extracted from mainnet; 240mi ctsi staked
    const BLOCK_DATA = ethers.utils.toUtf8Bytes("BlockData");

    const checkProduction = async (
        blockSelector: BlockSelectorV2,
        pos: PoSV2Aux,
        wallets: SignerWithAddress[],
        lowest: BigNumber,
        low: BigNumber,
        medium: BigNumber,
        high: BigNumber,
        checkPoint: number
    ) => {
        for (let i = 0; i < 100; i++) {
            await Promise.all(
                wallets.map(async ({ address }) => {
                    expect(
                        (await blockSelector.canProduceBlock(
                            0,
                            address,
                            lowest
                        )) ==
                            (await pos.canProduceBlockView(
                                mainnetDifficulty,
                                checkPoint,
                                address,
                                lowest
                            )),
                        "eligibility of lowest weight must match"
                    ).to.be.true;

                    expect(
                        (await blockSelector.canProduceBlock(
                            0,
                            address,
                            low
                        )) ==
                            (await pos.canProduceBlockView(
                                mainnetDifficulty,
                                checkPoint,
                                address,
                                low
                            )),
                        "eligibility of low weight must match"
                    ).to.be.true;

                    expect(
                        (await blockSelector.canProduceBlock(
                            0,
                            address,
                            medium
                        )) ==
                            (await pos.canProduceBlockView(
                                mainnetDifficulty,
                                checkPoint,
                                address,
                                medium
                            )),
                        "eligibility of medium weight must match"
                    ).to.be.true;

                    expect(
                        (await blockSelector.canProduceBlock(
                            0,
                            address,
                            high
                        )) ==
                            (await pos.canProduceBlockView(
                                mainnetDifficulty,
                                checkPoint,
                                address,
                                high
                            )),
                        "eligibility of high weight must match"
                    ).to.be.true;
                })
            );
            await advanceMultipleBlocks(provider, 256); // get a new hash on the process
            console.log(`\t\tFinished Round Session #${i}`);
        }
    };
    const checkProduction2 = async (
        blockSelector: BlockSelectorV2,
        pos: PoSV2Aux,
        weight: BigNumber,
        checkPoint: number
    ) => {
        let signerAddress = await signer.getAddress();
        let prevCanProduce = false;
        console.log(
            `selection start at block: ${await provider.getBlockNumber()}`
        );
        for (let i = 0; i < 48 * 60 * 5; i++) {
            let bsCanProduce = await blockSelector.canProduceBlock(
                0,
                signerAddress,
                weight
            );

            expect(
                bsCanProduce ==
                    (await pos.canProduceBlockView(
                        mainnetDifficulty,
                        checkPoint,
                        signerAddress,
                        weight
                    )),
                "eligibility must match"
            ).to.be.true;

            if (prevCanProduce != bsCanProduce) {
                console.log(
                    `user canProduce: ${bsCanProduce} at block: ${await provider.getBlockNumber()}`
                );
                prevCanProduce = bsCanProduce;
            }

            await advanceBlock(provider); // get a new hash on the process
        }
    };

    const deployBlockSelectorV2 = async (): Promise<BlockSelectorV2> => {
        const { deploy } = deployments;
        const { UnrolledCordic } = await deployments.all();

        const { address } = await deploy("BlockSelectorV2", {
            from: await signer.getAddress(),
            log: true,
            libraries: { UnrolledCordic: UnrolledCordic.address },
        });

        let blockSelector = BlockSelectorV2__factory.connect(address, signer);

        return blockSelector;
    };

    const deployPoSV2 = async (version: number): Promise<PoSV2Aux> => {
        const { deploy } = deployments;
        const { Bitmask, Difficulty, Eligibility, Tree } =
            await deployments.all();

        const { address } = await deploy("PoSV2Aux", {
            args: [
                mockCTSI.address,
                mockSI.address,
                mockWM.address,
                initialDiff,
                minDiff,
                diffAdjust,
                targetInterval,
                rewardValue,
                rewardDelay,
                version,
            ],
            from: await signer.getAddress(),
            log: true,
            libraries: {
                ["Bitmask"]: Bitmask.address,
                ["Difficulty"]: Difficulty.address,
                ["Eligibility"]: Eligibility.address,
                ["Tree"]: Tree.address,
            },
        });

        let pos = PoSV2Aux__factory.connect(address, signer);

        return pos;
    };

    const deployRewardManagerV2 = async (
        rewardValue: BigNumberish,
        rewardDelay: BigNumberish,
        posAddress: string = mockPoS.address
    ): Promise<RewardManagerV2Impl> => {
        const [signer] = await ethers.getSigners();
        const { Bitmask } = await deployments.all();

        const { deploy } = deployments;
        const { address } = await deploy("RewardManagerV2Impl", {
            from: signer.address,
            log: true,
            libraries: {
                ["Bitmask"]: Bitmask.address,
            },
            args: [mockCTSI.address, posAddress, rewardValue, rewardDelay],
        });

        let rewardManagerV2 = RewardManagerV2Impl__factory.connect(
            address,
            signer
        );
        return rewardManagerV2;
    };

    beforeEach(async () => {
        await deployments.fixture();

        const Staking = await deployments.getArtifact("Staking");
        const CTSI = await deployments.getArtifact("CartesiToken");
        const WorkerAuthManager = await deployments.getArtifact(
            "WorkerAuthManager"
        );
        const PoS = await deployments.getArtifact("PoSV2Impl");

        [signer, alice] = await ethers.getSigners();
        aliceAddress = await alice.getAddress();
        provider = signer.provider as JsonRpcProvider;

        mockSI = await deployMockContract(signer, Staking.abi);
        mockWM = await deployMockContract(signer, WorkerAuthManager.abi);
        mockCTSI = await deployMockContract(signer, CTSI.abi);
        mockPoS = await deployMockContract(signer, PoS.abi);
    });

    it("produceBlock(v1) 50 times", async () => {
        // deploy v1 chain
        let pos = await deployPoSV2(1);

        await mockWM.mock.isAuthorized.returns(true); // mock authorization
        await mockWM.mock.getOwner.returns(await signer.getAddress()); // mock owner
        await mockSI.mock.getStakedBalance.returns(100000000); // mock staked balance, to get selected easier
        await mockCTSI.mock.balanceOf.returns(rewardValue);
        await mockCTSI.mock.transfer.returns(true);

        await advanceMultipleBlocks(provider, 50);

        for (var i = 0; i < 50; ++i) {
            await pos["produceBlock(uint256)"](0);

            await advanceMultipleBlocks(provider, 250);
        }
    });

    it("produceBlock(v2) 50 times", async () => {
        // deploy v2 chain
        let pos = await deployPoSV2(2);

        await mockWM.mock.isAuthorized.returns(true); // mock authorization
        await mockWM.mock.getOwner.returns(await signer.getAddress()); // mock owner
        await mockSI.mock.getStakedBalance.returns(100000000); // mock staked balance, to get selected easier

        await advanceMultipleBlocks(provider, 50);
        await pos["produceBlock(uint32,bytes)"](0, BLOCK_DATA);

        for (var i = 0; i < 50; ++i) {
            await advanceMultipleBlocks(provider, 250);

            const tx = await pos["produceBlock(uint32,bytes)"](i, BLOCK_DATA);
        }
    });

    it("reward(v1) 50 times", async function () {
        let rewardManagerV1 = await deployRewardManagerV2(
            rewardValue,
            rewardDelay,
            await signer.getAddress()
        );

        await mockCTSI.mock.balanceOf.returns(2900);
        await mockCTSI.mock.transfer.returns(true);

        for (var i = 0; i < 50; ++i) {
            await rewardManagerV1["reward(uint32,address)"](
                i,
                await signer.getAddress()
            );
        }
    });

    it("reward(v2) 50 times", async function () {
        let rewardManagerV2 = await deployRewardManagerV2(
            rewardValue,
            rewardDelay
        );

        await mockCTSI.mock.balanceOf.returns(2900);
        await mockCTSI.mock.transfer.returns(true);
        await mockPoS.mock.isValidBlock.returns(true, aliceAddress);

        for (var i = 0; i < 50; ++i) {
            await rewardManagerV2["reward(uint32[])"]([
                4 * i,
                4 * i + 1,
                4 * i + 2,
                4 * i + 3,
            ]);
        }
    });

    it("internal functions gas estimate", async () => {
        // deploy v2 chain
        let pos = await deployPoSV2(2);

        await mockWM.mock.isAuthorized.returns(true); // mock authorization
        await mockWM.mock.getOwner.returns(await signer.getAddress()); // mock owner
        await mockSI.mock.getStakedBalance.returns(100000000); // mock staked balance, to get selected easier

        await advanceMultipleBlocks(provider, 50);
        await pos["produceBlock(uint32,bytes)"](0, BLOCK_DATA);

        for (var i = 0; i < 50; ++i) {
            await advanceMultipleBlocks(provider, 250);

            let info = await pos.getEligibilityInfo();
            await pos.canProduceBlockGas(info[0], info[1], info[2], info[3]);
            await pos._produceBlockGas();
            await pos.recordBlockGas(i, BLOCK_DATA);
            await pos.adjustDifficultyGas(5 * i);
        }
    });

    it("[regression] eligibility should exactly match BlockSelectorV2 (400 wallets in 100 cycles)", async () => {
        if (!process.env.REGRESSION == true) {
            console.log("\t skipping regression test", process.env.REGRESSION);
            return;
        }

        // [Important] This test validates the algorithm in `Eligibility` is equivalent to `BlockSelectorV2`
        // To run this test, one must change `C_40` to value `1` in `Eligibility.sol`
        let wallets = await ethers.getSigners();
        let lowestWeight = _1e18.mul(15 * 1000); // 15k
        let lowWeight = _1e18.mul(500 * 1000); // 500k
        let mediumWeight = _1e18.mul(2 * 1e6); // 2Mi
        let highWeight = _1e18.mul(20 * 1e6); // 20Mi

        // deploy v2 chain
        let pos = await deployPoSV2(2);
        let blockSelector = await deployBlockSelectorV2();

        await blockSelector.instantiate(
            minDiff,
            mainnetDifficulty,
            diffAdjust,
            targetInterval,
            await signer.getAddress()
        );

        let checkPoint = await provider.getBlockNumber();

        await advanceMultipleBlocks(provider, 254);
        await checkProduction(
            blockSelector,
            pos,
            wallets,
            lowestWeight,
            lowWeight,
            mediumWeight,
            highWeight,
            checkPoint
        );
    }).timeout(60 * 60 * 1000 * 60);

    it("[regression] eligibility should exactly match BlockSelectorV2 (1 wallet in 48 hours)", async () => {
        if (!process.env.REGRESSION == true) {
            console.log("\t skipping regression test", process.env.REGRESSION);
            return;
        }

        // [Important] This test validates the algorithm in `Eligibility` is equivalent to `BlockSelectorV2`
        // To run this test, one must change `C_40` to value `1` in `Eligibility.sol`
        let highWeight = _1e18.mul(20 * 1e6); // 20Mi

        // deploy v2 chain
        let pos = await deployPoSV2(2);
        let blockSelector = await deployBlockSelectorV2();

        await blockSelector.instantiate(
            minDiff,
            mainnetDifficulty,
            diffAdjust,
            targetInterval,
            await signer.getAddress()
        );

        let checkPoint = await provider.getBlockNumber();

        await checkProduction2(blockSelector, pos, highWeight, checkPoint);
    }).timeout(60 * 60 * 1000 * 60);
});
