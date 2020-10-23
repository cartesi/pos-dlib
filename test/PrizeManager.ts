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
} from "@nomiclabs/buidler";
import {
    deployMockContract,
    MockContract,
} from "@ethereum-waffle/mock-contract";
import { solidity } from "ethereum-waffle";

import { PrizeManager } from "../src/contracts/pos/PrizeManager";
import { Signer } from "ethers";

use(solidity);

describe("PrizeManager", async () => {
    let signer: Signer;
    let alice: Signer;
    let bob: Signer;

    let aliceAddress: string;

    let prizeManager: PrizeManager;
    let mockToken: MockContract;
    let mockPoS: MockContract;

    let minimumPrize = 10;
    let maxPrize = 270;
    let numerator = 5000;
    let denominator = 100000; // pays  5%

    const deployPrizeManager = async ({
        pos,
        ctsi,
        numerator,
        denominator,
    }: {
        pos?: string;
        ctsi?: string;
        minimumPrize?: number;
        maxPrize?: number;
        numerator?: number;
        denominator?: number;
    } = {}): Promise<PrizeManager> => {
        const posAddress = pos || (await deployments.get("PoS")).address;
        const ctsiAddress = ctsi || (await deployments.get("CartesiToken")).address;
        const prizeFactory = await ethers.getContractFactory("PrizeManager");
        const prizeManager = await prizeFactory.deploy(
            posAddress,
            ctsiAddress,
            maxPrize,
            minimumPrize,
            numerator,
            denominator
        );
        await prizeManager.deployed();
        return prizeManager as PrizeManager;
    };

    beforeEach(async () => {
        //await deployments.fixture();

        [signer, alice, bob] = await ethers.getSigners();
        aliceAddress = await alice.getAddress();
        const CartesiToken = await deployments.getArtifact("CartesiToken");
        mockToken = await deployMockContract(signer, CartesiToken.abi);
        mockPoS = await deployMockContract(signer, (await deployments.getArtifact("PoS")).abi);
    });

    it("payWinner can only be called by PoS", async () => {
        prizeManager = await deployPrizeManager({
            pos: mockPoS.address,
            ctsi: mockToken.address,
            numerator,
            denominator,
        });
        await mockToken.mock.balanceOf.returns(50000);
        await mockToken.mock.transfer.returns(true);
        await mockToken.mock.transferFrom.returns(true);
        await expect(
            prizeManager.payWinner(aliceAddress, 0),
            "function can only be called by operator contract"
        ).to.be.revertedWith(
            "Only the operator contract can call this function"
        );
    });

    it("current prize has to be bigger than zero", async () => {
        // deploy contract with signer as pos address
        prizeManager = await deployPrizeManager({
            pos: await signer.getAddress(),
            ctsi: mockToken.address,
            numerator,
            denominator,
        });

        await mockToken.mock.balanceOf.returns(0);
        await mockToken.mock.transfer.reverts();

        await expect(prizeManager.payWinner(aliceAddress, 0)).to.be.revertedWith(
            "Mock revert"
        );
    });

    it("payWinner should emit event", async () => {
        let balance = 50000;
        let prize = (balance * numerator) / denominator;

        // deploy contract with signer as pos address
        prizeManager = await deployPrizeManager({
            pos: await signer.getAddress(),
            ctsi: mockToken.address,
            numerator,
            denominator,
        });

        await mockToken.mock.balanceOf.returns(balance);
        await mockToken.mock.transfer.returns(true);
        await mockToken.mock.transferFrom.returns(true);

        await expect(
            prizeManager.payWinner(aliceAddress, prize),
            "paywinner should emit event"
        )
            .to.emit(prizeManager, "WinnerPaid")
            .withArgs(aliceAddress, prize);
    });

    it("current prize should generate prizes correctly", async () => {
        let balance = 500000;
        let lastPrize = 0;

        // deploy contract with signer as pos address
        prizeManager = await deployPrizeManager({
            pos: await signer.getAddress(),
            ctsi: mockToken.address,
            numerator,
            denominator,
        });
        await mockToken.mock.transfer.returns(true);
        await mockToken.mock.transferFrom.returns(true);

        // loops until balance is zero
        while (true) {
            balance = balance - lastPrize;

            if (balance == 0) break;

            lastPrize = Math.floor((balance * numerator) / denominator);
            lastPrize = lastPrize > minimumPrize ? lastPrize : minimumPrize;
            lastPrize = lastPrize > balance ? balance : lastPrize;

            await mockToken.mock.balanceOf.returns(balance);

            await expect(
                prizeManager.payWinner(aliceAddress, lastPrize),
                "paywinner should emit event"
            )
                .to.emit(prizeManager, "WinnerPaid")
                .withArgs(aliceAddress, lastPrize);
        }
    });
});
