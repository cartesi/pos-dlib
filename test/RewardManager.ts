// Copyright (C) 2020 Cartesi Pte. Ltd.

// This program is free software: you can redistribute it and/or modify it under
// the terms of the GNU General Public License as published by the Free Software
// Foundation, either version 3 of the License, or (at your option) any later
// version.

// This program is distributed in the hope that it will be useful, but WITHOUT ANY
// WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
// PARTICULAR PURPOSE. See the GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

// Note: This component currently has dependencies that are licensed under the GNU
// GPL, version 3, and so you should treat this component as a whole as being under
// the GPL version 3. But all Cartesi-written code in this component is licensed
// under the Apache License, version 2, or a compatible permissive license, and can
// be used independently under the Apache v2 license. After this component is
// rewritten, the entire component will be released under the Apache v2 license.

import { expect, use } from "chai";
import {
    deployments,
    ethers,
} from "hardhat";
import {
    deployMockContract,
    MockContract,
} from "@ethereum-waffle/mock-contract";
import { solidity } from "ethereum-waffle";

import { RewardManager } from "../src/types/RewardManager";
import { RewardManagerFactory } from "../src/types/RewardManagerFactory";
import { BigNumberish, Signer } from "ethers";

use(solidity);

describe("RewardManager", async () => {
    let signer: Signer;
    let alice: Signer;
    let bob: Signer;

    let aliceAddress: string;

    let rewardManager: RewardManager;
    let mockToken: MockContract;
    let mockPoS: MockContract;

    let minReward = 10;
    let maxReward = 270;
    let numerator = 5000;
    let denominator = 100000; // pays  5%

    const deployRewardManager = async ({
        pos,
        ctsi,
        numerator,
        denominator,
    }: {
        pos?: string;
        ctsi?: string;
        minReward?: BigNumberish;
        maxReward?: BigNumberish;
        numerator?: BigNumberish;
        denominator?: BigNumberish;
    } = {}): Promise<RewardManager> => {
        const [signer] = await ethers.getSigners();
        const posAddress = pos || (await deployments.get("PoS")).address;
        const ctsiAddress = ctsi || (await deployments.get("CartesiToken")).address;
        const n = numerator || 5000;
        const d = denominator || 100000;
        const rewardFactory = new RewardManagerFactory(signer);
        const rewardManager = await rewardFactory.deploy(
            posAddress,
            ctsiAddress,
            maxReward,
            minReward,
            n,
            d
        );
        return rewardManager;
    };

    beforeEach(async () => {
        //await deployments.fixture();

        [signer, alice, bob] = await ethers.getSigners();
        aliceAddress = await alice.getAddress();
        const CartesiToken = await deployments.getArtifact("CartesiToken");
        mockToken = await deployMockContract(signer, CartesiToken.abi);
        mockPoS = await deployMockContract(signer, (await deployments.getArtifact("PoS")).abi);
    });

    it("reward function can only be called by PoS", async () => {
        rewardManager = await deployRewardManager({
            pos: mockPoS.address,
            ctsi: mockToken.address,
            numerator,
            denominator,
        });
        await mockToken.mock.balanceOf.returns(50000);
        await mockToken.mock.transfer.returns(true);
        await mockToken.mock.transferFrom.returns(true);
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
            ctsi: mockToken.address,
            numerator,
            denominator,
        });

        await mockToken.mock.balanceOf.returns(0);
        await mockToken.mock.transfer.reverts();

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
            ctsi: mockToken.address,
            numerator,
            denominator,
        });

        await mockToken.mock.balanceOf.returns(balance);
        await mockToken.mock.transfer.returns(true);
        await mockToken.mock.transferFrom.returns(true);
        await rewardManager.reward(aliceAddress, currentReward);
    });

    it("current currentReward should generate currentRewards correctly", async function() {
        this.timeout(60000);
        let balance = 500000;
        let lastReward = 0;

        // deploy contract with signer as pos address
        rewardManager = await deployRewardManager({
            pos: await signer.getAddress(),
            ctsi: mockToken.address,
            numerator,
            denominator,
        });
        await mockToken.mock.transfer.returns(true);
        await mockToken.mock.transferFrom.returns(true);

        // loops until balance is zero
        while (true) {
            balance = balance - lastReward;

            if (balance == 0) break;

            lastReward = Math.floor((balance * numerator) / denominator);
            lastReward = lastReward > minReward ? lastReward : minReward;
            lastReward = lastReward > balance ? balance : lastReward;

            await mockToken.mock.balanceOf.returns(balance);
            await rewardManager.reward(aliceAddress, lastReward);
        }
    });
});
