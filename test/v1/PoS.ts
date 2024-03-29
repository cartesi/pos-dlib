// Copyright 2021 Cartesi Pte. Ltd.

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
import { solidity } from "ethereum-waffle";

import { PoS, PoS__factory } from "../../src/types";
import { Signer } from "ethers";

use(solidity);

describe("PoS", async () => {
    let signer: Signer;

    let pos: PoS;
    let mockSI: MockContract; //mock staking implementation
    let mockBS: MockContract; //mock block selector
    let mockRM: MockContract; //mock reward manager
    let mockWM: MockContract; //mock worker manager
    let mockCTSI: MockContract; //mock ctsi
    let minDiff = 1000000000;
    let initialDiff = 100;
    let diffAdjust = 50000;
    let targetInterval = 60 * 10; //10 minutes

    // RewardManager constructor parameters
    let minReward = 500;
    let maxReward = 120000;
    let numerator = 5;
    let denominator = 100;

    const NULL_ADDRESS = "0x0000000000000000000000000000000000000000"; //address(0)
    const ADDRESS_1 = "0x1111111111111111111111111111111111111111"; //address(1)
    const SPLIT_BASE = 10000;

    beforeEach(async () => {
        [signer] = await ethers.getSigners();

        const Staking = await deployments.getArtifact("Staking");
        const BlockSelector = await deployments.getArtifact("BlockSelector");
        const RewardManager = await deployments.getArtifact("RewardManager");
        const CTSI = await deployments.getArtifact("CartesiToken");
        const WorkerAuthManager = await deployments.getArtifact(
            "WorkerAuthManager"
        );

        mockSI = await deployMockContract(signer, Staking.abi);
        mockBS = await deployMockContract(signer, BlockSelector.abi);
        mockRM = await deployMockContract(signer, RewardManager.abi);
        mockWM = await deployMockContract(signer, WorkerAuthManager.abi);
        mockCTSI = await deployMockContract(signer, CTSI.abi);

        const posFactory = new PoS__factory(signer);
        pos = await posFactory.deploy();
    });

    it("instantiate should activate instance", async () => {
        await mockBS.mock.instantiate.returns(0); // mock block selector instantiate

        expect(
            await pos.isActive(0),
            "first instance should be inactive before instantiate call"
        ).to.equal(false);

        await pos.instantiate(
            mockSI.address,
            mockBS.address,
            mockWM.address,
            minDiff,
            initialDiff,
            diffAdjust,
            targetInterval,
            mockCTSI.address,
            maxReward,
            minReward,
            numerator,
            denominator
        );

        expect(
            await pos.isActive(0),
            "first instance should be active after instantiate call"
        ).to.equal(true);

        expect(
            await pos.isActive(1),
            "second instance should not be active before instantiate call"
        ).to.equal(false);

        await pos.instantiate(
            mockSI.address,
            mockBS.address,
            mockWM.address,
            minDiff,
            initialDiff,
            diffAdjust,
            targetInterval,
            mockCTSI.address,
            maxReward,
            minReward,
            numerator,
            denominator
        );

        expect(
            await pos.isActive(0),
            "first instance should be active after instantiate call"
        ).to.equal(true);

        expect(
            await pos.isActive(1),
            "second instance should be active after instantiate call"
        ).to.equal(true);
    });

    it("instantiate should emit event", async () => {
        await mockBS.mock.instantiate.returns(0); // mock block selector instantiate

        await expect(
            pos.instantiate(
                mockSI.address,
                mockBS.address,
                mockWM.address,
                minDiff,
                initialDiff,
                diffAdjust,
                targetInterval,
                mockCTSI.address,
                maxReward,
                minReward,
                numerator,
                denominator
            ),
            "instantiate should emit new chain events with correct args"
        )
            .to.emit(pos, "NewChain")
            .withArgs(
                0,
                mockSI.address,
                mockBS.address,
                mockWM.address,
                minDiff,
                initialDiff,
                diffAdjust,
                targetInterval,
                mockCTSI.address,
                maxReward,
                minReward,
                numerator,
                denominator
            );
    });

    it("terminate", async () => {
        await mockBS.mock.instantiate.returns(0); // mock block selector instantiate

        // simulate a non-empty reward
        await mockCTSI.mock.balanceOf.returns(1);

        await pos.instantiate(
            mockSI.address,
            mockBS.address,
            mockWM.address,
            minDiff,
            initialDiff,
            diffAdjust,
            targetInterval,
            mockCTSI.address,
            maxReward,
            minReward,
            numerator,
            denominator
        );

        expect(
            await pos.isActive(0),
            "first instance should be active after instantiate call"
        ).to.equal(true);

        await expect(
            pos.terminate(0),
            "non-empty RewardManager"
        ).to.be.revertedWith("RewardManager still holds funds");

        // empty RewardManager
        await mockCTSI.mock.balanceOf.returns(0);

        await pos.terminate(0);

        expect(
            await pos.isActive(0),
            "first instance should not be active after terminate call"
        ).to.equal(false);
    });

    it("rewards should be distributed correctly", async () => {
        let mockReward = 100000;
        await mockBS.mock.instantiate.returns(0); // mock block selector instantiate

        await pos.instantiate(
            mockSI.address,
            mockBS.address,
            mockWM.address,
            minDiff,
            initialDiff,
            diffAdjust,
            targetInterval,
            mockCTSI.address,
            maxReward,
            minReward,
            numerator,
            denominator
        );

        await mockWM.mock.isAuthorized.returns(true); // mock authorization
        await mockWM.mock.getOwner.returns(await signer.getAddress()); // mock owner
        await mockBS.mock.produceBlock.returns(true); // mock produce block
        await mockSI.mock.getStakedBalance.returns(1); // mock staked balance
        await mockCTSI.mock.balanceOf.returns(
            (mockReward * denominator) / numerator
        ); // mock current reward == 100k
        await mockCTSI.mock.transfer.returns(true); // mock current reward == 100k
        await mockRM.mock.reward.returns(); // mock current reward == 100k
        await mockRM.mock.reward.returns(); // mock current reward == 100k

        await expect(
            pos.produceBlock(0),
            "block produced should emit rewarded events with correct args"
        )
            .to.emit(pos, "Rewarded")
            .withArgs(
                0,
                await signer.getAddress(),
                await signer.getAddress(),
                mockReward // no beneficiary, user should receive full reward
            );
    });

    it("user should be concerned only if their ctsi balance > 0", async () => {
        await mockBS.mock.instantiate.returns(0); // mock block selector instantiate
        await mockSI.mock.getStakedBalance.returns(0); // mock zero staked balance

        await pos.instantiate(
            mockSI.address,
            mockBS.address,
            mockWM.address,
            minDiff,
            initialDiff,
            diffAdjust,
            targetInterval,
            mockCTSI.address,
            maxReward,
            minReward,
            numerator,
            denominator
        );

        expect(
            await pos.isConcerned(0, await signer.getAddress()),
            "user shouldnt be concerned, has zero balance"
        ).to.equal(false);

        await mockSI.mock.getStakedBalance.returns(1); // mock zero staked balance

        expect(
            await pos.isConcerned(0, await signer.getAddress()),
            "user should be concerned, balance > 0"
        ).to.equal(true);
    });

    it("subinstance should return block selector address and index", async () => {
        await mockBS.mock.instantiate.returns(0); // mock block selector instantiate

        await pos.instantiate(
            mockSI.address,
            mockBS.address,
            mockWM.address,
            minDiff,
            initialDiff,
            diffAdjust,
            targetInterval,
            mockCTSI.address,
            maxReward,
            minReward,
            numerator,
            denominator
        );

        var subInstance = await pos.getSubInstances(0, NULL_ADDRESS);

        expect(subInstance[0][0]).to.equal(mockBS.address);
        expect(subInstance[1][0]).to.equal(await pos.getBlockSelectorIndex(0));
    });

    it("getters should return the correct values", async () => {
        await mockBS.mock.instantiate.returns(0); // mock block selector instantiate

        await pos.instantiate(
            mockSI.address,
            mockBS.address,
            mockWM.address,
            minDiff,
            initialDiff,
            diffAdjust,
            targetInterval,
            mockCTSI.address,
            maxReward,
            minReward,
            numerator,
            denominator
        );
        var bsAddress = await pos.getBlockSelectorAddress(0);
        var siAddress = await pos.getStakingAddress(0);

        expect(bsAddress).to.equal(mockBS.address);
        expect(siAddress).to.equal(mockSI.address);
    });

    it("Reward Manager address should be unique per instance", async () => {
        await mockBS.mock.instantiate.returns(0); // mock block selector instantiate

        await pos.instantiate(
            mockSI.address,
            mockBS.address,
            mockWM.address,
            minDiff,
            initialDiff,
            diffAdjust,
            targetInterval,
            mockCTSI.address,
            maxReward,
            minReward,
            numerator,
            denominator
        );

        await pos.instantiate(
            mockSI.address,
            mockBS.address,
            mockWM.address,
            minDiff,
            initialDiff,
            diffAdjust,
            targetInterval,
            mockCTSI.address,
            maxReward,
            minReward,
            numerator,
            denominator
        );

        expect(await pos.getRewardManagerAddress(0)).to.not.equal(
            await pos.getRewardManagerAddress(1)
        );
    });
});
