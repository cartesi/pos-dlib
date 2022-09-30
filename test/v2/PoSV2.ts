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

import { PoSV2Impl, PoSV2Impl__factory } from "../../src/types";
import { Signer } from "ethers";
import { advanceMultipleBlocks } from "../utils";

use(solidity);

describe("PoSV2Impl", async () => {
    let provider: JsonRpcProvider;
    let alice: Signer;
    let signer: Signer;
    let aliceAddress: string;
    let signerAddress: string;

    let mockSI: MockContract; //mock staking implementation
    let mockWM: MockContract; //mock worker manager
    let mockCTSI: MockContract; //mock ctsi
    let minDiff = 100;
    let initialDiff = 100;
    let diffAdjust = 5000;
    let targetInterval = 40;

    // RewardManager constructor parameters
    let rewardValue = 1000;
    let rewardDelay = 0;

    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
    const ZERO_BYTES32 =
        "0x0000000000000000000000000000000000000000000000000000000000000000";
    const BLOCK_DATA = ethers.utils.toUtf8Bytes("BlockData");
    const HASH_BLOCK_DATA =
        "0xccedd52b38f92020e50ae698763233e77c6a3b5588d5099e2cf7845750337b82"; // hash of "blockData"
    const HEX_DATA = "0x426c6f636b44617461"; // hex representation of "BlockData"
    const UINT256_MAX =
        "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

    const deployPoSV2 = async (version: number): Promise<PoSV2Impl> => {
        const { deploy } = deployments;
        const { Bitmask, Difficulty, Eligibility, Tree } =
            await deployments.all();

        const { address } = await deploy("PoSV2Impl", {
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

        let pos = PoSV2Impl__factory.connect(address, signer);

        return pos;
    };

    beforeEach(async () => {
        await deployments.fixture();

        const Staking = await deployments.getArtifact("Staking");
        const CTSI = await deployments.getArtifact("CartesiToken");
        const WorkerAuthManager = await deployments.getArtifact(
            "WorkerAuthManager"
        );
        [signer, alice] = await ethers.getSigners();
        signerAddress = await signer.getAddress();
        aliceAddress = await alice.getAddress();

        provider = signer.provider as JsonRpcProvider;

        mockSI = await deployMockContract(signer, Staking.abi);
        mockWM = await deployMockContract(signer, WorkerAuthManager.abi);
        mockCTSI = await deployMockContract(signer, CTSI.abi);
    });

    it("block produced events", async () => {
        // deploy v1 chain
        let posV1 = await deployPoSV2(1);
        // deploy v2 chain
        let posV2 = await deployPoSV2(2);

        await mockWM.mock.isAuthorized.returns(true); // mock authorization
        await mockWM.mock.getOwner.returns(aliceAddress); // mock owner
        await mockSI.mock.getStakedBalance.returns(100000000); // mock staked balance, to get selected easier
        await mockCTSI.mock.balanceOf.returns(rewardValue);
        await mockCTSI.mock.transfer.returns(true);

        await advanceMultipleBlocks(provider, 50);

        expect(
            await posV1.canProduceBlock(signerAddress),
            "should be eligible(v1)"
        ).to.be.true;

        await expect(
            posV1["produceBlock(uint256)"](0),
            "produceBlock(v1) should emit block produced events with correct args"
        )
            .to.emit(posV1, "BlockProduced")
            .withArgs(aliceAddress, signerAddress, 0, "0x");

        expect(
            await posV2.canProduceBlock(signerAddress),
            "should be eligible(v2)"
        ).to.be.true;

        await expect(
            posV2["produceBlock(uint32,bytes)"](0, BLOCK_DATA),
            "produceBlock(v2) should emit block produced events with correct args"
        )
            .to.emit(posV2, "BlockProduced")
            .withArgs(aliceAddress, signerAddress, 0, HEX_DATA);
    });

    it("terminate", async () => {
        // deploy v1 chain
        let pos = await deployPoSV2(1);

        expect(await pos.active(), "chain should be active after created").to.be
            .true;

        let posAliceSender = PoSV2Impl__factory.connect(pos.address, alice);

        await expect(
            posAliceSender.terminate(),
            "only owner can terminate"
        ).to.be.revertedWith("Ownable: caller is not the owner");

        await expect(
            posAliceSender.transferOwnership(signerAddress),
            "only owner can terminate"
        ).to.be.revertedWith("Ownable: caller is not the owner");

        await mockCTSI.mock.balanceOf.returns(100);

        await expect(
            pos.terminate(),
            "non-empty RewardManager"
        ).to.be.revertedWith("RewardManager still holds funds");

        await mockCTSI.mock.balanceOf.returns(0);

        await pos.terminate();

        expect(await pos.active(), "chain should be terminated").to.be.false;
    });

    it("getters should return the correct values", async () => {
        // deploy v1 chain
        let posV1 = await deployPoSV2(1);
        // deploy v2 chain
        let posV2 = await deployPoSV2(2);

        await mockWM.mock.isAuthorized.returns(true); // mock authorization
        await mockWM.mock.getOwner.returns(aliceAddress); // mock owner
        await mockSI.mock.getStakedBalance.returns(100000000); // mock staked balance, to get selected easier
        await mockCTSI.mock.balanceOf.returns(rewardValue);
        await mockCTSI.mock.transfer.returns(true);

        await advanceMultipleBlocks(provider, 50);

        let txV1 = await posV1["produceBlock(uint256)"](0);
        let txV2 = await posV2["produceBlock(uint32,bytes)"](0, BLOCK_DATA);

        expect(
            await posV1.getEthBlockStamp(),
            "ethBlockStamp should match after produceBlock(v1)"
        ).to.equal(txV1.blockNumber);

        expect(
            await posV2.getEthBlockStamp(),
            "ethBlockStamp should match after produceBlock(v2)"
        ).to.equal(txV2.blockNumber);

        expect(
            await posV1.getLastProducer(),
            "lastProducer should match after produceBlock(v1)"
        ).to.equal(aliceAddress);

        expect(
            await posV2.getLastProducer(),
            "lastProducer should match after produceBlock(v2)"
        ).to.equal(aliceAddress);

        expect(
            await posV1.getSidechainBlockCount(),
            "sidechainBlockCount should match after produceBlock(v1)"
        ).to.equal(1);

        expect(
            await posV2.getSidechainBlockCount(),
            "sidechainBlockCount should match after produceBlock(v2)"
        ).to.equal(1);

        expect(
            await posV1.getSidechainBlock(0),
            "sidechainBlock shouldn't be available for produceBlock(v1)"
        ).to.deep.equal([ZERO_ADDRESS, 0, ZERO_BYTES32]);

        expect(
            await posV2.getSidechainBlock(0),
            "sidechainBlock should match after produceBlock(v2)"
        ).to.deep.equal([aliceAddress, txV2.blockNumber, HASH_BLOCK_DATA]);

        await advanceMultipleBlocks(provider, 50);

        await posV2["produceBlock(uint32,bytes)"](0, BLOCK_DATA);

        expect(
            await posV2.isValidBlock(1, 1),
            "block not deep enough is invalid"
        ).to.deep.equal([false, ZERO_ADDRESS]);

        expect(
            await posV2.isValidBlock(0, 1),
            "genesis block is valid when depth diff = 1"
        ).to.deep.equal([true, aliceAddress]);

        expect(
            await posV2.isValidBlock(1, 0),
            "block should be valid when depth diff = 0"
        ).to.deep.equal([true, aliceAddress]);

        await advanceMultipleBlocks(provider, 150);

        await posV2["produceBlock(uint32,bytes)"](0, BLOCK_DATA);

        expect(
            await posV2.isValidBlock(2, 0),
            "block not on the longest valid path"
        ).to.deep.equal([false, ZERO_ADDRESS]);

        expect(
            await posV2.whenCanProduceBlock(aliceAddress),
            "should return uint256_max when goal is not set"
        ).to.equal(UINT256_MAX);

        expect(
            await posV2.canProduceBlock(aliceAddress),
            "shouldn't be eligible when goal is not set"
        ).to.be.false;

        expect(
            await posV2.getSelectionBlocksPassed(),
            "should return 0 when goal is not set"
        ).to.equal(0);

        // goal is set at ethBlockStamp + 40
        await advanceMultipleBlocks(provider, 40);

        expect(
            await posV2.getSelectionBlocksPassed(),
            "should return 0 at exact goal block"
        ).to.equal(0);

        await advanceMultipleBlocks(provider, 1);

        expect(
            await posV2.getSelectionBlocksPassed(),
            "should return 1 when goal is not set"
        ).to.equal(1);

        let previousEligibility = await posV2.whenCanProduceBlock(aliceAddress);

        await advanceMultipleBlocks(provider, 255);

        let newEligibility = await posV2.whenCanProduceBlock(aliceAddress);

        expect(
            previousEligibility,
            "eligibility should remain the same after 256 blocks"
        ).to.equal(newEligibility);

        expect(
            await posV2.getSelectionBlocksPassed(),
            "should return 256"
        ).to.equal(256);

        await advanceMultipleBlocks(provider, 10);

        expect(
            await posV2.getSelectionBlocksPassed(),
            "should return 10 after 266 blocks of block goal"
        ).to.equal(10);

        await mockSI.mock.getStakedBalance.returns(0);

        expect(
            await posV2.whenCanProduceBlock(aliceAddress),
            "should return uint256_max when stake is 0"
        ).to.equal(UINT256_MAX);

        await mockSI.mock.getStakedBalance.returns(1);

        expect(
            await posV2.whenCanProduceBlock(aliceAddress),
            "small staker should be able to produce long time after"
        ).to.not.equal(UINT256_MAX);

        expect(
            await posV1.getRewardManagerAddress(0),
            "reward manager(v1) address cannot be zero"
        ).to.not.equal(ZERO_ADDRESS);

        expect(
            await posV2.getRewardManagerAddress(0),
            "reward manager(v2) address cannot be zero"
        ).to.not.equal(ZERO_ADDRESS);

        expect(
            await posV2.getRewardManagerAddress(0),
            "index is ignored for get reward manager address"
        ).to.be.equal(await posV2.getRewardManagerAddress(1));

        expect(
            await posV1.workerAuth(),
            "worker manager(v1) address should match"
        ).to.be.equal(mockWM.address);

        expect(
            await posV2.workerAuth(),
            "worker manager(v2) address should match"
        ).to.be.equal(mockWM.address);

        expect(
            await posV1.staking(),
            "staking(v1) address should match"
        ).to.be.equal(mockSI.address);

        expect(
            await posV2.staking(),
            "staking(v2) address should match"
        ).to.be.equal(mockSI.address);

        expect(await posV1.owner(), "owner(v1) should match").to.be.equal(
            signerAddress
        );

        expect(await posV2.owner(), "owner(v2) should match").to.be.equal(
            signerAddress
        );

        expect(await posV1.version(), "version(v1) should be 1").to.be.equal(1);

        expect(await posV2.version(), "version(v2) should be 2").to.be.equal(2);
    });

    it("produce block reverts", async () => {
        // deploy v1 chain
        let posV1 = await deployPoSV2(1);
        // deploy v2 chain
        let posV2 = await deployPoSV2(2);

        await expect(
            posV1["produceBlock(uint32,bytes)"](0, BLOCK_DATA),
            "cannot produce V2 blocks in V1 chain"
        ).to.be.revertedWith("protocol has to be V2");

        await expect(
            posV2["produceBlock(uint256)"](0),
            "cannot produce V1 blocks in V2 chain"
        ).to.be.revertedWith("protocol has to be V1");

        await mockWM.mock.isAuthorized.returns(false); // mock authorization

        await expect(
            posV1["produceBlock(uint256)"](0),
            "sender must be authorized"
        ).to.be.revertedWith("msg.sender is not authorized");

        await mockWM.mock.isAuthorized.returns(true); // mock authorization
        await mockWM.mock.getOwner.returns(aliceAddress); // mock owner
        await mockSI.mock.getStakedBalance.returns(100); // mock small staked balance

        await expect(
            posV1["produceBlock(uint256)"](0),
            "not eligible to produce"
        ).to.be.revertedWith("User couldnt produce a block");
    });
});
