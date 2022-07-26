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
import { BigNumberish, Signer } from "ethers";
import {
    deployMockContract,
    MockContract,
} from "@ethereum-waffle/mock-contract";
import { solidity } from "ethereum-waffle";

import { RewardManager, RewardManager__factory } from "../../src/types";

use(solidity);

describe("RewardManager", async () => {
    let signer: Signer;
    let alice: Signer;

    let aliceAddress: string;

    let rewardManager: RewardManager;
    let mockCTSI: MockContract;

    let minReward = 500;
    let maxReward = 1200;
    let numerator = 5;
    let denominator = 100;

    const deployRewardManager = async ({
        pos,
        ctsi,
        numerator,
        denominator,
        isConstant,
    }: {
        pos?: string;
        ctsi?: string;
        minReward?: BigNumberish;
        maxReward?: BigNumberish;
        numerator?: BigNumberish;
        denominator?: BigNumberish;
        isConstant?: boolean;
    } = {}): Promise<RewardManager> => {
        const [signer] = await ethers.getSigners();
        const posAddress = pos || (await deployments.get("PoS")).address;
        const ctsiAddress =
            ctsi || (await deployments.get("CartesiToken")).address;
        const n = numerator || 5000;
        const d = denominator || 100000;
        const rewardFactory = new RewardManager__factory(signer);
        let rewardManager;
        if (isConstant) {
            rewardManager = await rewardFactory.deploy(
                posAddress,
                ctsiAddress,
                maxReward,
                minReward,
                d,
                d
            );
        } else {
            rewardManager = await rewardFactory.deploy(
                posAddress,
                ctsiAddress,
                maxReward,
                minReward,
                n,
                d
            );
        }
        return rewardManager;
    };

    beforeEach(async () => {
        //await deployments.fixture();

        [signer, alice] = await ethers.getSigners();
        aliceAddress = await alice.getAddress();
        const CartesiToken = await deployments.getArtifact("CartesiToken");
        mockCTSI = await deployMockContract(signer, CartesiToken.abi);
    });

    it("reward function can only be called by PoS", async () => {
        rewardManager = await deployRewardManager({
            pos: mockCTSI.address, // not signer's address
            ctsi: mockCTSI.address,
            numerator,
            denominator,
        });
        await mockCTSI.mock.balanceOf.returns(50000);
        await mockCTSI.mock.transfer.returns(true);
        await mockCTSI.mock.transferFrom.returns(true);
        await expect(
            rewardManager.reward(aliceAddress, 0),
            "function can only be called by operator contract"
        ).to.be.revertedWith(
            "Only the operator contract can call this function"
        );
    });

    it("current currentReward has to be bigger than zero", async () => {
        // deploy contract with signer as pos address
        rewardManager = await deployRewardManager({
            pos: await signer.getAddress(),
            ctsi: mockCTSI.address,
            numerator,
            denominator,
        });

        await mockCTSI.mock.balanceOf.returns(0);
        await mockCTSI.mock.transfer.reverts();

        await expect(rewardManager.reward(aliceAddress, 0)).to.be.revertedWith(
            "Mock revert"
        );
    });

    it("reward should emit event", async () => {
        let balance = 50000;
        let currentReward = (balance * numerator) / denominator;

        // deploy contract with signer as pos address
        rewardManager = await deployRewardManager({
            pos: await signer.getAddress(),
            ctsi: mockCTSI.address,
            numerator,
            denominator,
        });

        await mockCTSI.mock.balanceOf.returns(balance);
        await mockCTSI.mock.transfer.returns(true);
        await mockCTSI.mock.transferFrom.returns(true);
        await rewardManager.reward(aliceAddress, currentReward);
    });

    it("numerator == denominator should generate constant reward of max prize", async function () {
        let balance = 25000; //12500000;
        let lastReward = 0;
        let isConstant = true; //is constant
        // deploy contract with signer as pos address
        rewardManager = await deployRewardManager({
            pos: await signer.getAddress(),
            ctsi: mockCTSI.address,
            numerator,
            denominator,
            isConstant, //constant
        });
        await mockCTSI.mock.transfer.returns(true);
        await mockCTSI.mock.transferFrom.returns(true);
        // loops until balance is zero
        while (true) {
            balance = Math.floor(balance - maxReward);

            if (balance < maxReward) break;

            await mockCTSI.mock.balanceOf.returns(balance);
            expect(
                await rewardManager.getCurrentReward(),
                "current reward has to be correct"
            ).to.equal(maxReward);
            await mockCTSI.mock.balanceOf.returns(balance - maxReward);
        }
    });

    it("current currentReward should generate currentRewards correctly", async function () {
        this.timeout(60000);
        let balance = 25000; //12500000;
        let lastReward = 0;

        // deploy contract with signer as pos address
        rewardManager = await deployRewardManager({
            pos: await signer.getAddress(),
            ctsi: mockCTSI.address,
            numerator,
            denominator,
        });
        await mockCTSI.mock.transfer.returns(true);
        await mockCTSI.mock.transferFrom.returns(true);

        // loops until balance is zero
        while (true) {
            balance = Math.floor(balance - lastReward);

            await mockCTSI.mock.balanceOf.returns(balance);
            expect(
                await rewardManager.getBalance(),
                "current reward has to be correct"
            ).to.equal(balance);

            if (balance == 0) break;

            lastReward = Math.floor((balance * numerator) / denominator);
            lastReward = lastReward > minReward ? lastReward : minReward;
            lastReward = lastReward > maxReward ? maxReward : lastReward;
            lastReward = Math.floor(
                lastReward > balance ? balance : lastReward
            );

            await mockCTSI.mock.balanceOf.returns(balance);
            expect(
                await rewardManager.getCurrentReward(),
                "current reward has to be correct"
            ).to.equal(lastReward);

            await mockCTSI.mock.balanceOf.returns(balance);
            //await rewardManager.reward(aliceAddress, lastReward);
        }
    });
});
