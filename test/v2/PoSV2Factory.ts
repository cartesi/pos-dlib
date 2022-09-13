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
import { JsonRpcProvider } from "@ethersproject/providers";
import { solidity } from "ethereum-waffle";

import { PoSV2FactoryImpl, PoSV2FactoryImpl__factory } from "../../src/types";
import { Signer } from "ethers";

use(solidity);

describe("PoSV2Factorympl", async () => {
    let posV2Factory: PoSV2FactoryImpl;

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
    let diffAdjust = 1;
    let targetInterval = 138;

    // RewardManager constructor parameters
    let rewardValue = 1000;
    let rewardDelay = 0;

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

        const { PoSV2FactoryImpl } = await deployments.all();
        posV2Factory = PoSV2FactoryImpl__factory.connect(
            PoSV2FactoryImpl.address,
            signer
        );
    });

    it("new chain events", async () => {
        let posV1 = await posV2Factory.callStatic.createNewChain(
            mockCTSI.address,
            mockSI.address,
            mockWM.address,
            initialDiff,
            minDiff,
            diffAdjust,
            targetInterval,
            rewardValue,
            rewardDelay,
            1
        );

        await expect(
            posV2Factory.createNewChain(
                mockCTSI.address,
                mockSI.address,
                mockWM.address,
                initialDiff,
                minDiff,
                diffAdjust,
                targetInterval,
                rewardValue,
                rewardDelay,
                1
            ),
            "createNewChain(v1) should emit events"
        )
            .to.emit(posV2Factory, "NewChain")
            .withArgs(
                posV1,
                mockCTSI.address,
                mockSI.address,
                mockWM.address,
                initialDiff,
                minDiff,
                diffAdjust,
                targetInterval,
                rewardValue,
                rewardDelay,
                1
            );

        // deploy v2 chain
        let posV2 = await posV2Factory.callStatic.createNewChain(
            mockCTSI.address,
            mockSI.address,
            mockWM.address,
            initialDiff,
            minDiff,
            diffAdjust,
            targetInterval,
            rewardValue,
            rewardDelay,
            2
        );

        await expect(
            posV2Factory.createNewChain(
                mockCTSI.address,
                mockSI.address,
                mockWM.address,
                initialDiff,
                minDiff,
                diffAdjust,
                targetInterval,
                rewardValue,
                rewardDelay,
                2
            ),
            "createNewChain(v2) should emit events"
        )
            .to.emit(posV2Factory, "NewChain")
            .withArgs(
                posV2,
                mockCTSI.address,
                mockSI.address,
                mockWM.address,
                initialDiff,
                minDiff,
                diffAdjust,
                targetInterval,
                rewardValue,
                rewardDelay,
                2
            );

        let posV2FactoryAliceSender = PoSV2FactoryImpl__factory.connect(
            posV2Factory.address,
            alice
        );

        await expect(
            posV2FactoryAliceSender.createNewChain(
                mockCTSI.address,
                mockSI.address,
                mockWM.address,
                initialDiff,
                minDiff,
                diffAdjust,
                targetInterval,
                rewardValue,
                rewardDelay,
                2
            ),
            "only owner can create new chain"
        ).to.be.revertedWith("Ownable: caller is not the owner");
    });
});
