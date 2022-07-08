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
} from "../src/types";

const { solidity, deployMockContract } = waffle;

use(solidity);

describe("RewardManagerV2", async () => {
    let signer: Signer;
    let alice: Signer;

    let aliceAddress: string;

    let mockToken: MockContract;
    let mockPoS: MockContract;

    let rewardValue = 2900;
    let rewardDelay = 1;

    const deployRewardManagerV2 = async (
        rewardValue: BigNumberish,
        rewardDelay: BigNumberish,
        posAddress: String = mockPoS.address
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
            args: [mockToken.address, posAddress, rewardValue, rewardDelay],
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
        aliceAddress = await alice.getAddress();
        const CartesiToken = await deployments.getArtifact("CartesiToken");
        const PoS = await deployments.getArtifact("PoSV2Impl");
        mockToken = await deployMockContract(signer, CartesiToken.abi);
        mockPoS = await deployMockContract(signer, PoS.abi);
    });

    it("reward(v1) 50 times", async function () {
        let rewardManagerV2 = await deployRewardManagerV2(
            rewardValue,
            rewardDelay,
            await signer.getAddress()
        );

        await mockToken.mock.balanceOf.returns(2900);
        await mockToken.mock.transfer.returns(true);

        for (var i = 0; i < 50; ++i) {
            await rewardManagerV2["reward(uint32,address)"](
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

        await mockToken.mock.balanceOf.returns(2900);
        await mockToken.mock.transfer.returns(true);
        await mockPoS.mock.isValidBlock.returns(true, aliceAddress);

        for (var i = 0; i < 50; ++i) {
            await rewardManagerV2["reward(uint32)"](i);
        }
    });
});
