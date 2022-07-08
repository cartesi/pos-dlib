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

import { PoSV2GasAux } from "../src/types/PoSV2GasAux";
import { PoSV2GasAux__factory } from "../src/types/factories/PoSV2GasAux__factory";
import { Signer } from "ethers";
import { advanceMultipleBlocks } from "./utils";

use(solidity);

describe("PoSV2GasAux", async () => {
    let provider: JsonRpcProvider;
    let signer: Signer;

    let mockSI: MockContract; //mock staking implementation
    let mockWM: MockContract; //mock worker manager
    let mockCTSI: MockContract; //mock ctsi
    let minDiff = 100;
    let initialDiff = 100;
    let diffAdjust = 1;
    let targetInterval = 60 * 10; //10 minutes

    // RewardManager constructor parameters
    let rewardValue = 1000;
    let rewardDelay = 0;

    const BLOCK_DATA = ethers.utils.toUtf8Bytes("BlockData");
    const HEX_DATA = "0x426c6f636b44617461"; // hex representation of "BlockData"

    const deployPoSV2 = async (version: number): Promise<PoSV2GasAux> => {
        const { deploy } = deployments;
        const { Bitmask, Difficulty, Eligibility, Tree } =
            await deployments.all();

        const { address } = await deploy("PoSV2GasAux", {
            args: [
                mockCTSI.address,
                mockSI.address,
                mockWM.address,
                minDiff,
                initialDiff,
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

        let pos = PoSV2GasAux__factory.connect(address, signer);

        return pos;
    };

    beforeEach(async () => {
        await deployments.fixture();

        const Staking = await deployments.getArtifact("Staking");
        const CTSI = await deployments.getArtifact("CartesiToken");
        const WorkerAuthManager = await deployments.getArtifact(
            "WorkerAuthManager"
        );

        [signer] = await ethers.getSigners();
        provider = signer.provider as JsonRpcProvider;

        mockSI = await deployMockContract(signer, Staking.abi);
        mockWM = await deployMockContract(signer, WorkerAuthManager.abi);
        mockCTSI = await deployMockContract(signer, CTSI.abi);
    });

    // expect(
    //     tx,
    //     "block produced should emit BlockProduced events with correct args"
    // )
    //     .to.emit(pos, "BlockProduced")
    //     .withArgs(
    //         await signer.getAddress(),
    //         await signer.getAddress(),
    //         i,
    //         blockNumber + 1,
    //         "0x"
    //     );

    // expect(
    //     tx,
    //     "block produced V2 should emit BlockProduced events with correct args"
    // )
    //     .to.emit(pos, "BlockProduced")
    //     .withArgs(
    //         await signer.getAddress(),
    //         await signer.getAddress(),
    //         i + 1,
    //         tx.blockNumber!,
    //         HEX_DATA
    //     );

    it("produceBlock(v1) 50 times", async () => {
        // deploy v1 chain
        let pos: PoSV2GasAux = await deployPoSV2(1);

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
        let pos: PoSV2GasAux = await deployPoSV2(2);

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

    it("internal functions gas estimate", async () => {
        // deploy v2 chain
        let pos: PoSV2GasAux = await deployPoSV2(2);

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
});
