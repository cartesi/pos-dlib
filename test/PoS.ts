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
import { deployments, ethers } from "hardhat";
import {
    deployMockContract,
    MockContract,
} from "@ethereum-waffle/mock-contract";
import { solidity } from "ethereum-waffle";

import { PoS } from "../src/types/PoS";
import { PoSFactory } from "../src/types/PoSFactory";
import { Signer } from "ethers";

use(solidity);

describe("PoS", async () => {
    let signer: Signer;

    let pos: PoS;
    let mockSI: MockContract; //mock staking implementation
    let mockBS: MockContract; //mock block selector
    let mockRM: MockContract; //mock reward manager
    let mockWM: MockContract; //mock worker manager
    let minDiff = 1000000000;
    let initialDiff = 100;
    let diffAjdust = 50000;
    let targetInterval = 60 * 10; //10 minutes

    const NULL_ADDRESS = "0x0000000000000000000000000000000000000000"; //address(0)
    const ADDRESS_1 = "0x1111111111111111111111111111111111111111"; //address(1)
    const SPLIT_BASE = 10000;

    beforeEach(async () => {
        [signer] = await ethers.getSigners();

        const Staking = await deployments.getArtifact("Staking");
        const BlockSelector = await deployments.getArtifact("BlockSelector");
        const RewardManager = await deployments.getArtifact("RewardManager");
        const WorkerAuthManager = await deployments.getArtifact(
            "WorkerAuthManager"
        );

        mockSI = await deployMockContract(signer, Staking.abi);
        mockBS = await deployMockContract(signer, BlockSelector.abi);
        mockRM = await deployMockContract(signer, RewardManager.abi);
        mockWM = await deployMockContract(signer, WorkerAuthManager.abi);

        const posFactory = new PoSFactory(signer);
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
            diffAjdust,
            targetInterval,
            mockRM.address
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
            diffAjdust,
            targetInterval,
            NULL_ADDRESS
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

    it("pos instances should have a unique reward manager address", async () => {
        await mockBS.mock.instantiate.returns(0); // mock block selector instantiate

        await pos.instantiate(
            mockSI.address,
            mockBS.address,
            mockWM.address,
            minDiff,
            initialDiff,
            diffAjdust,
            targetInterval,
            mockRM.address
        );

        await expect(
            pos.instantiate(
                mockSI.address,
                mockBS.address,
                mockWM.address,
                minDiff,
                initialDiff,
                diffAjdust,
                targetInterval,
                mockRM.address
            ),
            "reward manager has to be unique for each instance"
        ).to.be.revertedWith(
            "This RewardManager address has been used by another instance"
        );
    });

    it("addBeneficiary revert cases", async () => {
        await mockBS.mock.instantiate.returns(0); // mock block selector instantiate

        await pos.instantiate(
            mockSI.address,
            mockBS.address,
            mockWM.address,
            minDiff,
            initialDiff,
            diffAjdust,
            targetInterval,
            mockRM.address
        );

        await expect(
            pos.addBeneficiary(0, NULL_ADDRESS, SPLIT_BASE + 1),
            "split variable has to be less or equal than SPLIT_BASE"
        ).to.be.revertedWith("split has to be less than 100%");
    });

    it("addBeneficiary should emit event", async () => {
        await expect(
            pos.addBeneficiary(0, NULL_ADDRESS, SPLIT_BASE),
            "adding beneficiary correctly should emit event"
        )
            .to.emit(pos, "BeneficiaryAdded")
            .withArgs(0, await signer.getAddress(), NULL_ADDRESS, SPLIT_BASE);

        await expect(
            pos.addBeneficiary(0, NULL_ADDRESS, SPLIT_BASE / 2),
            "adding beneficiary correctly should emit event"
        )
            .to.emit(pos, "BeneficiaryAdded")
            .withArgs(
                0,
                await signer.getAddress(),
                NULL_ADDRESS,
                SPLIT_BASE / 2
            );
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
            diffAjdust,
            targetInterval,
            mockRM.address
        );

        await mockWM.mock.isAuthorized.returns(true); // mock authorization
        await mockWM.mock.getOwner.returns(await signer.getAddress()); // mock owner
        await mockBS.mock.produceBlock.returns(true); // mock produce block
        await mockSI.mock.getStakedBalance.returns(1); // mock staked balance
        await mockRM.mock.getCurrentReward.returns(mockReward); // mock current reward == 100k
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
                NULL_ADDRESS,
                mockReward, // no beneficiary, user should receive full reward
                0
            );

        // add beneficiary with 50/50 split
        await expect(
            pos.addBeneficiary(0, ADDRESS_1, SPLIT_BASE / 2),
            "adding beneficiary correctly should emit event"
        )
            .to.emit(pos, "BeneficiaryAdded")
            .withArgs(0, await signer.getAddress(), ADDRESS_1, SPLIT_BASE / 2);

        await expect(
            pos.produceBlock(0),
            "block produced should emit rewarded events with correct args"
        )
            .to.emit(pos, "Rewarded")
            .withArgs(
                0,
                await signer.getAddress(),
                await signer.getAddress(),
                ADDRESS_1,
                mockReward / 2, //50/50 beneficiary, user should receive half reward
                mockReward / 2 //beneficiary should receive half reward
            );

        // add beneficiary with 33/66 split
        await expect(
            pos.addBeneficiary(0, ADDRESS_1, Math.floor(SPLIT_BASE / 3)),
            "adding beneficiary correctly should emit event"
        )
            .to.emit(pos, "BeneficiaryAdded")
            .withArgs(
                0,
                await signer.getAddress(),
                ADDRESS_1,
                Math.floor(SPLIT_BASE / 3)
            );

        await expect(
            pos.produceBlock(0),
            "block produced should emit rewarded events with correct args"
        )
            .to.emit(pos, "Rewarded")
            .withArgs(
                0,
                await signer.getAddress(),
                await signer.getAddress(),
                ADDRESS_1,
                66670, //Math.floor(mockReward * 2/3), //66/33 beneficiary
                33330 //Math.floor(mockReward / 3)
            );

        await expect(
            pos.addBeneficiary(0, ADDRESS_1, Math.floor(SPLIT_BASE / 4)),
            "adding beneficiary correctly should emit event"
        )
            .to.emit(pos, "BeneficiaryAdded")
            .withArgs(
                0,
                await signer.getAddress(),
                ADDRESS_1,
                Math.floor(SPLIT_BASE / 4)
            );

        await expect(
            pos.produceBlock(0),
            "block produced should emit rewarded events with correct args"
        )
            .to.emit(pos, "Rewarded")
            .withArgs(
                0,
                await signer.getAddress(),
                await signer.getAddress(),
                ADDRESS_1,
                Math.floor((mockReward * 3) / 4), //75/25 beneficiary
                Math.floor(mockReward / 4)
            );

        await expect(
            pos.addBeneficiary(0, ADDRESS_1, SPLIT_BASE),
            "adding beneficiary correctly should emit event"
        )
            .to.emit(pos, "BeneficiaryAdded")
            .withArgs(0, await signer.getAddress(), ADDRESS_1, SPLIT_BASE);

        await expect(
            pos.produceBlock(0),
            "block produced should emit rewarded events with correct args"
        )
            .to.emit(pos, "Rewarded")
            .withArgs(
                0,
                await signer.getAddress(),
                await signer.getAddress(),
                ADDRESS_1,
                0, //100/0 beneficiary
                mockReward
            );
    });
});
