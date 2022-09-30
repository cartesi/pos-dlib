// Copyright 2021 Cartesi Pte. Ltd.

// Licensed under the Apache License, Version 2.0 (the "License"); you may not use
// this file except in compliance with the License. You may obtain a copy of the
// License at http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software distributed
// under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
// CONDITIONS OF ANY KIND, either express or implied. See the License for the
// specific language governing permissions and limitations under the License.

import { expect, use, util } from "chai";
import { deployments, ethers } from "hardhat";
import { BigNumberish, BigNumber, Signer, Wallet } from "ethers";
import { JsonRpcProvider } from "@ethersproject/providers";
import { solidity, MockProvider } from "ethereum-waffle";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import { BlockSelectorV2 } from "../../src/types/contracts/BlockSelectorV2";
import { BlockSelectorV2__factory } from "../../src/types/factories/contracts/BlockSelectorV2__factory";

import { advanceBlock, advanceMultipleBlocks } from "../utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

use(solidity);

describe("BlockSelectorV2", async () => {
    let provider: JsonRpcProvider;
    let signer: Signer;
    let alice: Signer;

    let blockSelector: BlockSelectorV2;

    let minDiff = 100;
    let initialDiff = 100;
    let diffAdjust = 50000;
    let targetInterval = 40; //40 blocks ~= 10 minutes
    const _1e18 = BigNumber.from(10).pow(18);

    const checkProduction = async (
        blockSelector: BlockSelectorV2,
        wallets: SignerWithAddress[],
        lowest: BigNumber,
        low: BigNumber,
        medium: BigNumber,
        high: BigNumber
    ): Promise<Array<number>> => {
        let lowestWeightCount = 0;
        let lowWeightCount = 0;
        let mediumWeightCount = 0;
        let highWeightCount = 0;

        for (let i = 0; i < 100; i++) {
            await Promise.all(
                wallets.map(async ({ address }) => {
                    if (await blockSelector.canProduceBlock(0, address, lowest))
                        lowestWeightCount++;

                    if (await blockSelector.canProduceBlock(0, address, low))
                        lowWeightCount++;

                    if (await blockSelector.canProduceBlock(0, address, medium))
                        mediumWeightCount++;

                    if (await blockSelector.canProduceBlock(0, address, high))
                        highWeightCount++;
                })
            );
            await advanceMultipleBlocks(provider, 256); // get a new hash on the process
            console.log(`\t\tFinished Round Session #${i}`);
        }

        return [
            lowestWeightCount,
            lowWeightCount,
            mediumWeightCount,
            highWeightCount,
        ];
    };

    async function setup() {
        await deployments.fixture();

        const { deploy } = deployments;
        [signer, alice] = await ethers.getSigners();
        provider = signer.provider as JsonRpcProvider;

        const { UnrolledCordic } = await deployments.all();
        const { address } = await deploy("BlockSelectorV2", {
            from: await signer.getAddress(),
            log: true,
            libraries: { UnrolledCordic: UnrolledCordic.address },
        });

        blockSelector = BlockSelectorV2__factory.connect(address, signer);
    }

    beforeEach(async () => {
        // ensure we are always using a clean contract
        await loadFixture(setup);
    });

    it("instantiate should activate the instance", async () => {
        expect(
            await blockSelector.isActive(0),
            "first instance should be inactive before instantiate call"
        ).to.equal(false);

        await blockSelector.instantiate(
            minDiff,
            initialDiff,
            diffAdjust,
            targetInterval,
            await signer.getAddress()
        );

        expect(
            await blockSelector.isActive(0),
            "first instance should be active after instantiate call"
        ).to.equal(true);

        expect(
            await blockSelector.isActive(1),
            "second instance should not be active before instantiate call"
        ).to.equal(false);

        await blockSelector.instantiate(
            minDiff,
            initialDiff,
            diffAdjust,
            targetInterval,
            await signer.getAddress()
        );

        expect(
            await blockSelector.isActive(0),
            "first instance should be active after instantiate call"
        ).to.equal(true);

        expect(
            await blockSelector.isActive(1),
            "second instance should be active after instantiate call"
        ).to.equal(true);
    });

    it("produce block reverts if weight is zero", async () => {
        await blockSelector.instantiate(
            minDiff,
            initialDiff,
            diffAdjust,
            targetInterval,
            await signer.getAddress()
        );

        // advance blocks so the target is set
        await advanceBlock(provider);
        await advanceBlock(provider);

        await expect(
            blockSelector.produceBlock(0, await signer.getAddress(), 0),
            "weight should be bigger than zero"
        ).to.be.revertedWith("Caller can't have zero staked tokens");
    });

    it("produce block can only be called by operator address", async () => {
        await blockSelector.instantiate(
            minDiff,
            initialDiff,
            diffAdjust,
            targetInterval,
            await alice.getAddress()
        );

        // advance blocks so the target is set
        await advanceBlock(provider);
        await advanceBlock(provider);

        await expect(
            blockSelector.produceBlock(0, await signer.getAddress(), 50),
            "function wasn't called by operator address"
        ).to.be.revertedWith("Function can only be called by pos address");
    });

    it("the amount of addresses eligible should increase with mainchain blocks", async () => {
        const mockProvider = new MockProvider();
        var address: string;
        let wallets = mockProvider.getWallets();
        let weigth = 5000000;
        let initialCount = 0;
        let midwayCount = 0;
        let finalCount = 0;

        await blockSelector.instantiate(
            minDiff,
            initialDiff,
            diffAdjust,
            targetInterval,
            await signer.getAddress()
        );

        // advance blocks so the target is set
        await advanceBlock(provider);
        await advanceBlock(provider);

        for (var wallet of wallets) {
            address = await wallet.getAddress();
            if (await blockSelector.canProduceBlock(0, address, weigth)) {
                initialCount++;
            }
        }

        await advanceMultipleBlocks(provider, 20);

        for (var wallet of wallets) {
            address = await wallet.getAddress();
            if (await blockSelector.canProduceBlock(0, address, weigth)) {
                midwayCount++;
            }
        }

        await advanceMultipleBlocks(provider, 120);

        for (var wallet of wallets) {
            address = await wallet.getAddress();
            if (await blockSelector.canProduceBlock(0, address, weigth)) {
                finalCount++;
            }
        }

        expect(
            initialCount,
            "initial count should be less than midway count"
        ).to.below(midwayCount);
        expect(
            midwayCount,
            "midway count should be less than final count"
        ).to.below(finalCount);
    });

    it("[regression] small weight should eventually be able to produce", async () => {
        if (!process.env.REGRESSION == true) {
            console.log("\t skipping regression test", process.env.REGRESSION);
            return;
        }
        let wallets = await ethers.getSigners();
        let lowestWeight = _1e18.mul(15 * 1000); // 15k
        let lowWeight = _1e18.mul(500 * 1000); // 500k
        let mediumWeight = _1e18.mul(2 * 1e6); // 2Mi
        let highWeight = _1e18.mul(20 * 1e6); // 20Mi
        let initialDifficulty = BigNumber.from("25798284791319440457930"); //extracted from mainnet; 240mi ctsi staked
        await blockSelector.instantiate(
            minDiff,
            initialDifficulty,
            diffAdjust,
            targetInterval,
            await signer.getAddress()
        );

        await advanceMultipleBlocks(provider, 254);
        let [
            lowestWeightCount,
            lowWeightCount,
            mediumWeightCount,
            highWeightCount,
        ] = await checkProduction(
            blockSelector,
            wallets,
            lowestWeight,
            lowWeight,
            mediumWeight,
            highWeight
        );
        console.log(
            "\tRegression results: \n",
            JSON.stringify(
                {
                    lowestWeightCount,
                    lowWeightCount,
                    mediumWeightCount,
                    highWeightCount,
                },
                null,
                2
            )
        );

        expect(
            lowestWeightCount,
            "lowest weight count should be less than low weight count"
        ).to.below(lowWeightCount);
        expect(
            lowWeightCount,
            "low weight count should be less than medium weight count"
        ).to.below(mediumWeightCount);
        expect(
            mediumWeightCount,
            "medium weight count should be less than high weight count"
        ).to.below(highWeightCount);
    }).timeout(60 * 60 * 1000 * 60);

    it("the weight variable should increase chance of producing a block", async () => {
        let wallets = await ethers.getSigners();
        let lowWeightCount = 0;
        let highWeightCount = 0;
        let mediumWeightCount = 0;
        let lowWeight = 1;
        let mediumWeight = 900000;
        let highWeight = 500000000000000;

        await blockSelector.instantiate(
            minDiff,
            initialDiff,
            diffAdjust,
            targetInterval,
            await signer.getAddress()
        );

        await advanceMultipleBlocks(provider, 120);

        for (var wallet of wallets) {
            let { address } = wallet;
            if (await blockSelector.canProduceBlock(0, address, lowWeight)) {
                lowWeightCount++;
            }

            if (await blockSelector.canProduceBlock(0, address, mediumWeight)) {
                mediumWeightCount++;
            }
            if (await blockSelector.canProduceBlock(0, address, highWeight)) {
                highWeightCount++;
            }
        }
        expect(
            lowWeightCount,
            "low weight count should be less than medium weight count"
        ).to.below(mediumWeightCount);

        expect(
            mediumWeightCount,
            "medium weight count should be less than high weight count"
        ).to.below(highWeightCount);
    });

    // TODO: this test should also make sure that the diff is changing by adjustment param
    it("difficulty should adjust according to number of blocks passed", async () => {
        let address = await signer.getAddress();
        let highWeight = 100000000000000;
        await blockSelector.instantiate(
            minDiff,
            initialDiff,
            diffAdjust,
            targetInterval,
            address
        );

        var diff: BigNumberish = await blockSelector.getDifficulty(0);

        // advance blocks so the target is set
        await advanceBlock(provider);
        await advanceBlock(provider);

        expect(
            diff,
            "after instantiate difficulty should be equal do initial difficulty"
        ).to.equal(initialDiff);

        // weight is very high to ensure block gets produced
        await blockSelector.produceBlock(0, address, highWeight);

        var newDiff = await blockSelector.getDifficulty(0);

        expect(
            newDiff,
            "difficulty should increase if block was produced too quickly"
        ).to.be.above(initialDiff);

        await advanceMultipleBlocks(provider, targetInterval + 5);

        await blockSelector.produceBlock(0, address, highWeight);

        diff = await blockSelector.getDifficulty(0);

        expect(
            diff,
            "difficulty should decrease if block took longer than target interval be produced"
        ).to.be.below(newDiff);

        await advanceMultipleBlocks(provider, 20); // advance 20 blocks

        await blockSelector.produceBlock(0, address, highWeight);

        await advanceMultipleBlocks(provider, 20); // advance 20 blocks

        await blockSelector.produceBlock(0, address, highWeight);

        await advanceMultipleBlocks(provider, 20); // advance 20 blocks

        await blockSelector.produceBlock(0, address, highWeight);

        diff = await blockSelector.getDifficulty(0);

        expect(
            diff,
            "difficulty should increase after multiple blocks that were produced quickly"
        ).to.be.above(initialDiff);
    });

    it("every 256 blocks target should be updated", async () => {
        const mockProvider = new MockProvider();
        let wallets = mockProvider.getWallets();
        let mediumWeight = 900000;
        var initialTargetCount = 0;
        var falseUpdateTargetCount = 0;
        var updatedTargetCount = 0;

        await blockSelector.instantiate(
            minDiff,
            initialDiff,
            diffAdjust,
            targetInterval,
            await signer.getAddress()
        );

        await advanceMultipleBlocks(provider, 256);

        for (var wallet of wallets) {
            var address = await wallet.getAddress();
            if (await blockSelector.canProduceBlock(0, address, mediumWeight)) {
                initialTargetCount++;
            }
        }

        await advanceMultipleBlocks(provider, 1);

        // target shouldn't change, this is the edge case
        for (var wallet of wallets) {
            var address = await wallet.getAddress();
            if (await blockSelector.canProduceBlock(0, address, mediumWeight)) {
                falseUpdateTargetCount++;
            }
        }

        await advanceMultipleBlocks(provider, 2);

        // total blocks advanced = 256 + 1 + 2, should trigger seed update
        for (var wallet of wallets) {
            var address = await wallet.getAddress();
            if (await blockSelector.canProduceBlock(0, address, mediumWeight)) {
                updatedTargetCount++;
            }
        }

        expect(
            initialTargetCount,
            "256 block advancement should mantain target"
        ).to.equal(falseUpdateTargetCount);

        expect(
            initialTargetCount,
            ">256 should update target and therefore statistically have different winners"
        ).to.not.equal(updatedTargetCount);

        await blockSelector.produceBlock(
            0,
            await signer.getAddress(),
            mediumWeight * 1000000
        ); // high weight to guarantee block will be produced

        await advanceMultipleBlocks(provider, 512);

        for (var wallet of wallets) {
            var address = await wallet.getAddress();
            if (await blockSelector.canProduceBlock(0, address, mediumWeight)) {
                initialTargetCount++;
            }
        }

        await advanceMultipleBlocks(provider, 1);

        // target shouldn't change, this is the edge case
        for (var wallet of wallets) {
            var address = await wallet.getAddress();
            if (await blockSelector.canProduceBlock(0, address, mediumWeight)) {
                falseUpdateTargetCount++;
            }
        }

        await advanceMultipleBlocks(provider, 2);

        // total blocks advanced = 256 + 1 + 2, should trigger seed update
        for (var wallet of wallets) {
            var address = await wallet.getAddress();
            if (await blockSelector.canProduceBlock(0, address, mediumWeight)) {
                updatedTargetCount++;
            }
        }

        expect(
            initialTargetCount,
            "512 block advancement should mantain target"
        ).to.equal(falseUpdateTargetCount);

        expect(
            initialTargetCount,
            ">512 should update target and therefore statistically have different winners"
        ).to.not.equal(updatedTargetCount);
    });

    it("producing block resets selection", async () => {
        let mediumWeight = 5000000;
        let address = await signer.getAddress();

        await blockSelector.instantiate(
            minDiff,
            initialDiff,
            diffAdjust,
            targetInterval,
            address
        );

        // advance blocks so the target is set
        await advanceBlock(provider);
        await advanceBlock(provider);

        // advance time so a block can definitely be produced
        await advanceMultipleBlocks(provider, 1000);

        // produce a block
        await blockSelector.produceBlock(0, address, mediumWeight);

        // advance blocks so the target is set
        await advanceBlock(provider);
        await advanceBlock(provider);

        expect(
            await blockSelector.canProduceBlock(0, address, mediumWeight),
            "selection was reset, block shouldnt be produced"
        ).to.equal(false);
    });

    it("isConcerned should always return false", async () => {
        let address = await signer.getAddress();

        expect(
            await blockSelector.isConcerned(0, address),
            "user should never be concerned by blockselector"
        ).to.equal(false);

        await blockSelector.instantiate(
            minDiff,
            initialDiff,
            diffAdjust,
            targetInterval,
            address
        );
        expect(
            await blockSelector.isConcerned(0, address),
            "user should never be concerned by blockselector"
        ).to.equal(false);
    });

    it("getSubInstances should return empty", async () => {
        let address = await signer.getAddress();

        await blockSelector.instantiate(
            minDiff,
            initialDiff,
            diffAdjust,
            targetInterval,
            address
        );

        var subInstances = await blockSelector.getSubInstances(0, address);

        expect(subInstances[0].length).to.equal(0);
        expect(subInstances[1].length).to.equal(0);
    });

    it("blocks passed should reset after 256 blocks", async () => {
        let address = await signer.getAddress();

        await blockSelector.instantiate(
            minDiff,
            initialDiff,
            diffAdjust,
            targetInterval,
            address
        );

        var blocksPassed = await blockSelector.getSelectionBlockDuration(0);
        expect(blocksPassed, "blocks passed should start at zero").to.equal(0);

        // 256 blocks + 1 for target to be set
        await advanceMultipleBlocks(provider, 257);

        blocksPassed = await blockSelector.getSelectionBlockDuration(0);
        expect(
            blocksPassed,
            "blocks passed should be 256 after advancing 257 blocks"
        ).to.equal(256);

        await advanceMultipleBlocks(provider, 1);

        blocksPassed = await blockSelector.getSelectionBlockDuration(0);
        expect(
            blocksPassed,
            "blocks passed should be 1 after advancing 257 blocks in total"
        ).to.equal(1);

        await advanceMultipleBlocks(provider, 255);

        blocksPassed = await blockSelector.getSelectionBlockDuration(0);
        expect(
            blocksPassed,
            "blocks passed should be 256 after advancing 512 blocks in total"
        ).to.equal(256);

        await advanceMultipleBlocks(provider, 35);

        blocksPassed = await blockSelector.getSelectionBlockDuration(0);
        expect(
            blocksPassed,
            "blocks passed should be 35 after advancing 537 blocks in total"
        ).to.equal(35);
    });

    it("getters should return expected values", async () => {
        let address = await signer.getAddress();
        let highWeight = 500000000000000;

        await blockSelector.instantiate(
            minDiff,
            initialDiff,
            diffAdjust,
            targetInterval,
            address
        );

        var blockCount = await blockSelector.getBlockCount(0);
        var difficulty = await blockSelector.getDifficulty(0);
        var minDifficulty = await blockSelector.getMinDifficulty(0);
        var adjustmentParam =
            await blockSelector.getDifficultyAdjustmentParameter(0);
        var gTargetInterval = await blockSelector.getTargetInterval(0);
        var blocksPassed = await blockSelector.getSelectionBlockDuration(0);

        expect(blockCount, "blockCount should start at zero").to.equal(0);
        expect(difficulty, "difficulty should start as initialDiffi").to.equal(
            initialDiff
        );
        expect(
            minDifficulty,
            "getMinDiff should return minimumDifficulty"
        ).to.equal(minDiff);
        expect(
            adjustmentParam,
            "getAdjustmentParam should return adjustment parameter"
        ).to.equal(diffAdjust);
        expect(
            gTargetInterval,
            "getTargetInterval should return target interval"
        ).to.equal(targetInterval);
        expect(blocksPassed, "blocks passed should start at zero").to.equal(0);

        // advance 1 block to set goal, then advance 200 blocks
        await advanceMultipleBlocks(provider, 201);

        var sBlocksPassed = await blockSelector.getSelectionBlockDuration(0);

        expect(sBlocksPassed, "200 blocks should have passed").to.equal(200); //blocks
        // produce a block

        await blockSelector.produceBlock(0, address, highWeight);

        blockCount = await blockSelector.getBlockCount(0);

        expect(
            blockCount,
            "blockCount should be one after first block is created"
        ).to.be.equal(1);
    });
});
