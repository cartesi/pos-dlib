// Copyright 2021 Cartesi Pte. Ltd.

// Licensed under the Apache License, Version 2.0 (the "License"); you may not use
// this file except in compliance with the License. You may obtain a copy of the
// License at http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software distributed
// under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
// CONDITIONS OF ANY KIND, either express or implied. See the License for the
// specific language governing permissions and limitations under the License.

import { expect, use } from "chai";
import { deployments, ethers, waffle } from "hardhat";
import { BigNumberish, Signer } from "ethers";
import { MockContract } from "ethereum-waffle";

import {
    RewardManagerV2Impl,
    RewardManagerV2Impl__factory,
} from "../../src/types";

const { solidity, deployMockContract } = waffle;

use(solidity);

describe("RewardManagerV2", async () => {
    let signer: Signer;
    let alice: Signer;

    let signerAddress: string;
    let aliceAddress: string;

    let mockCTSI: MockContract;
    let mockPoS: MockContract;

    let rewardValue = 2900;
    let rewardDelay = 1;

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

        [signer, alice] = await ethers.getSigners();
        signerAddress = await signer.getAddress();
        aliceAddress = await alice.getAddress();

        const CartesiToken = await deployments.getArtifact("CartesiToken");
        const PoS = await deployments.getArtifact("PoSV2Impl");

        mockCTSI = await deployMockContract(signer, CartesiToken.abi);
        mockPoS = await deployMockContract(signer, PoS.abi);
    });

    it("reward events", async function () {
        let rewardManagerV1 = await deployRewardManagerV2(
            rewardValue,
            rewardDelay,
            signerAddress
        );

        let rewardManagerV2 = await deployRewardManagerV2(
            rewardValue,
            rewardDelay
        );

        await mockCTSI.mock.balanceOf.returns(rewardValue);
        await mockCTSI.mock.transfer.returns(true);

        await expect(
            rewardManagerV1["reward(uint32,address)"](10, aliceAddress),
            "reward(v1) should emit event"
        )
            .to.emit(rewardManagerV1, "Rewarded")
            .withArgs(10, rewardValue);

        await mockCTSI.mock.balanceOf.returns(rewardValue - 500);

        await expect(
            rewardManagerV1["reward(uint32,address)"](5, aliceAddress),
            "reward(v1) should emit event"
        )
            .to.emit(rewardManagerV1, "Rewarded")
            .withArgs(5, rewardValue - 500);

        await mockPoS.mock.isValidBlock.returns(true, aliceAddress);

        await expect(
            rewardManagerV2["reward(uint32[])"]([3]),
            "reward(v2) should emit event"
        )
            .to.emit(rewardManagerV2, "Rewarded")
            .withArgs(3, rewardValue - 500);
    });

    it("reward reverts", async function () {
        let rewardManagerV1 = await deployRewardManagerV2(
            rewardValue,
            rewardDelay,
            signerAddress
        );

        await mockCTSI.mock.balanceOf.returns(rewardValue);
        await mockCTSI.mock.transfer.returns(true);

        let rewardAliceSender = RewardManagerV2Impl__factory.connect(
            rewardManagerV1.address,
            alice
        );

        await expect(
            rewardAliceSender["reward(uint32,address)"](5, aliceAddress),
            "only pos can call reward(v1)"
        ).to.be.revertedWith("Only the pos contract can call");

        await mockPoS.mock.isValidBlock.returns(false, aliceAddress);

        let rewardManagerV2 = await deployRewardManagerV2(
            rewardValue,
            rewardDelay
        );

        await expect(
            rewardManagerV2["reward(uint32[])"]([0, 1, 2]),
            "cannot reward(v2) invalid block"
        ).to.be.revertedWith("Invalid block");

        await mockPoS.mock.isValidBlock.returns(true, aliceAddress);
        await mockCTSI.mock.balanceOf.returns(0);

        await expect(
            rewardManagerV2["reward(uint32[])"]([3]),
            "insufficient balance for reward"
        ).to.be.revertedWith("RewardManager has no funds");

        await mockCTSI.mock.balanceOf.returns(rewardValue);

        await rewardManagerV2["reward(uint32[])"]([3]),
            "reward(v2) should emit event";

        await expect(
            rewardManagerV2["reward(uint32[])"]([3]),
            "cannot double reward(v2)"
        ).to.be.revertedWith("The block has been rewarded");
    });

    it("getter functions return the correct values", async function () {
        let rewardManagerV2 = await deployRewardManagerV2(
            rewardValue,
            rewardDelay
        );

        await mockCTSI.mock.balanceOf.returns(50);

        expect(
            await rewardManagerV2.getBalance(),
            "balance should match"
        ).to.equal(50);

        expect(await rewardManagerV2.getCurrentReward(), "low reward").to.equal(
            50
        );

        await mockCTSI.mock.balanceOf.returns(3500);

        expect(
            await rewardManagerV2.getCurrentReward(),
            "sufficient reward"
        ).to.equal(rewardValue);

        expect(await rewardManagerV2.isRewarded(0), "block 0 is not rewarded")
            .to.be.false;

        expect(await rewardManagerV2.isRewarded(1), "block 1 is not rewarded")
            .to.be.false;

        expect(await rewardManagerV2.isRewarded(2), "block 2 is not rewarded")
            .to.be.false;

        await mockCTSI.mock.transfer.returns(true);
        await mockPoS.mock.isValidBlock.returns(true, aliceAddress);

        await rewardManagerV2["reward(uint32[])"]([2, 3, 4, 5]);

        expect(
            await rewardManagerV2.isRewarded(0),
            "block 0 remain not rewarded"
        ).to.be.false;

        expect(
            await rewardManagerV2.isRewarded(1),
            "block 1 remain not rewarded"
        ).to.be.false;

        expect(await rewardManagerV2.isRewarded(2), "block 2 is rewarded").to.be
            .true;

        expect(await rewardManagerV2.isRewarded(3), "block 3 is rewarded").to.be
            .true;

        expect(await rewardManagerV2.isRewarded(4), "block 4 is rewarded").to.be
            .true;

        expect(await rewardManagerV2.isRewarded(5), "block 5 is rewarded").to.be
            .true;
    });
});
