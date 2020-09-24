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
import { deployments, ethers } from "@nomiclabs/buidler";
import {
    deployMockContract,
    MockContract
} from "@ethereum-waffle/mock-contract";
import { solidity } from "ethereum-waffle";

import { Staking } from "../src/contracts/pos/Staking";
import { Signer } from "ethers";

const { advanceTime, advanceBlock } = require("./utils");

use(solidity);

describe("Staking", async () => {
    const DAY = 86400; // seconds in a day
    const MATURATION = 5 * DAY + 1;

    let signer: Signer;

    let staking: Staking;
    let mockToken: MockContract;

    const deployStaking = async ({
        ctsi
    }: {
        ctsi?: string;
    } = {}): Promise<Staking> => {
        const ctsiAddress =
            ctsi || (await deployments.get("CartesiToken")).address;
        const stakingFactory = await ethers.getContractFactory("StakingImpl");
        const staking = await stakingFactory.deploy(
            ctsiAddress,
            5 * DAY,
            5 * DAY
        );
        await staking.deployed();
        return staking as Staking;
    };

    beforeEach(async () => {
        [signer] = await ethers.getSigners();

        const CartesiToken = await deployments.getArtifact("CartesiToken");
        mockToken = await deployMockContract(signer, CartesiToken.abi);
        staking = await deployStaking({ ctsi: mockToken.address });
    });

    it("deposit stake should emit event", async () => {
        let toBeDeposited = 5;

        // mock transfer from as true
        await mockToken.mock.transferFrom.returns(true);

        // TODO: fix the event parameter for maturation date
        //       the date is a bit unreliable, because the block.timestamp varies
        await expect(
            staking.stake(toBeDeposited),
            "Deposting stake should emit event"
        ).to.emit(staking, "Stake");
    });

    it("stake shouldnt change staked balance if tokens are not mature", async () => {
        let toBeDeposited = 5;
        // mock transfer from as true
        await mockToken.mock.transferFrom.returns(true);

        // await deposit
        await staking.stake(toBeDeposited);

        expect(
            await staking.getStakedBalance(await signer.getAddress()),
            "staked Balance should still be zero, deposit not finalized"
        ).to.equal(0);
    });

    it("mature deposits should count as stake", async () => {
        let toBeDeposited = 5;
        // mock transfer from as true
        await mockToken.mock.transferFrom.returns(true);

        await staking.stake(toBeDeposited);
        let sAddress = await signer.getAddress();

        await advanceTime(signer.provider, MATURATION);
        await advanceBlock(signer.provider);

        expect(
            await staking.getStakedBalance(sAddress),
            "staked balance should match finalized deposit"
        ).to.equal(toBeDeposited);
    });

    it("new deposits should reset maturation date", async () => {
        let toBeDeposited = 5;
        // mock transfer from as true
        await mockToken.mock.transferFrom.returns(true);

        await staking.stake(toBeDeposited);
        await advanceTime(signer.provider, MATURATION / 2);
        await staking.stake(toBeDeposited);

        await advanceTime(signer.provider, MATURATION / 3);
        await advanceBlock(signer.provider);

        expect(
            await staking.getStakedBalance(await signer.getAddress()),
            "staked balance should match finalized deposit"
        ).to.equal(0);

        await advanceTime(signer.provider, MATURATION);
        await advanceBlock(signer.provider);

        expect(
            await staking.getStakedBalance(await signer.getAddress()),
            "staked balance should match finalized deposit"
        ).to.equal(2 * toBeDeposited);
    });

    it("multiple deposit should mature at once", async () => {
        let toBeDeposited = 5;
        // mock transfer from as true
        await mockToken.mock.transferFrom.returns(true);
        // test with multiple deposits

        await staking.stake(toBeDeposited);
        await staking.stake(toBeDeposited);
        await staking.stake(toBeDeposited);

        await advanceTime(signer.provider, MATURATION);
        await advanceBlock(signer.provider);

        expect(
            await staking.getStakedBalance(await signer.getAddress()),
            "staked balance should include all 3 deposits"
        ).to.equal(3 * toBeDeposited);
    });

    it("withdraw should revert if releases are not ready", async () => {
        let toBeWithdrew = 5;
        await expect(
            staking.withdraw(toBeWithdrew),
            "should revert if unstaked hasnt been called"
        ).to.be.revertedWith("not enough tokens waiting to be released");
    });

    it("withdraw should revert if amount is zero", async () => {
        let toBeDeposited = 5;
        await mockToken.mock.transferFrom.returns(true);
        await staking.stake(toBeDeposited);

        await expect(
            staking.withdraw(0),
            "withdraw if amount is zero"
        ).to.be.revertedWith("amount cant be zero");
    });

    it("withdraw should revert if tokens are not ready to be released", async () => {
        let toBeDeposited = 5;
        await mockToken.mock.transferFrom.returns(true);
        await staking.stake(toBeDeposited);

        await advanceTime(signer.provider, MATURATION);
        await advanceBlock(signer.provider);

        await staking.unstake(toBeDeposited);

        await expect(
            staking.withdraw(toBeDeposited),
            "should revert if tokens are not ready to be released"
        ).to.be.revertedWith("tokens are not yet ready to be released");
    });

    it("unstake should revert if amount is zero", async () => {
        await expect(
            staking.unstake(0),
            "amount cant be zero"
        ).to.be.revertedWith("amount cant be zero");
    });

    it("unstake should revert if amount is too big", async () => {
        let toBeDeposited = 5;

        await expect(
            staking.unstake(1),
            "not enough tokens to unstake"
        ).to.be.revertedWith("revert SafeMath: subtraction overflow");

        await mockToken.mock.transferFrom.returns(true);
        await staking.stake(toBeDeposited);

        await advanceTime(signer.provider, MATURATION);
        await advanceBlock(signer.provider);

        await expect(
            staking.unstake(toBeDeposited + 1),
            "not enough tokens to unstake"
        ).to.be.revertedWith("revert SafeMath: subtraction overflow");
    });

    it("unstake should move funds from m.amount first", async () => {
        let toBeDeposited = 5;

        await mockToken.mock.transferFrom.returns(true);
        await staking.stake(toBeDeposited);

        await advanceTime(signer.provider, MATURATION);
        await advanceBlock(signer.provider);

        await staking.stake(toBeDeposited);

        await staking.unstake(toBeDeposited);

        expect(
            await staking.getStakedBalance(await signer.getAddress()),
            "staked balance should include all 3 deposits"
        ).to.equal(toBeDeposited);

        await staking.unstake(toBeDeposited);

        expect(
            await staking.getStakedBalance(await signer.getAddress()),
            "staked balance should include all 3 deposits"
        ).to.equal(0);
    });

    it("unstake should emit event", async () => {
        let toBeDeposited = 5;

        await mockToken.mock.transferFrom.returns(true);
        await staking.stake(toBeDeposited);

        await expect(
            staking.unstake(toBeDeposited),
            "Unstake should emit event"
        ).to.emit(staking, "Unstake");
    });

    it("withdraw should emit event", async () => {
        let toBeDeposited = 5;

        await mockToken.mock.transferFrom.returns(true);
        await staking.stake(toBeDeposited);
        await staking.unstake(toBeDeposited);

        await advanceTime(signer.provider, MATURATION);
        await advanceBlock(signer.provider);

        await mockToken.mock.transfer.returns(true);

        await expect(
            staking.withdraw(toBeDeposited),
            "Deposting stake should emit event"
        ).to.emit(staking, "Withdraw");
    });

    it("maturing timestamp getter", async () => {
        let toBeDeposited = 5;
        var now = new Date().getSeconds(); // time in ms

        await mockToken.mock.transferFrom.returns(true);
        await staking.stake(toBeDeposited);

        var maturing = await staking.getMaturingTimestamp(
            await signer.getAddress()
        );

        expect(
            maturing,
            "maturing timestamp should be bigger than now"
        ).to.be.above(now);
    });

    it("maturing balance getter", async () => {
        let toBeDeposited = 5;

        await mockToken.mock.transferFrom.returns(true);
        await staking.stake(toBeDeposited);

        expect(
            await staking.getMaturingBalance(await signer.getAddress()),
            "maturing balance should be toBeDeposit"
        ).to.equal(toBeDeposited);

        await advanceTime(signer.provider, MATURATION);
        await advanceBlock(signer.provider);

        expect(
            await staking.getMaturingBalance(await signer.getAddress()),
            "maturing balance shouldnt count matured balance"
        ).to.equal(0);

        await mockToken.mock.transferFrom.returns(true);
        await staking.stake(toBeDeposited);

        expect(
            await staking.getMaturingBalance(await signer.getAddress()),
            "maturing balance should be toBeDeposit after new deposit"
        ).to.equal(toBeDeposited);
    });

    it("releasing timestamp getter", async () => {
        let toBeDeposited = 5;
        var now = new Date().getSeconds(); // time in ms

        await mockToken.mock.transferFrom.returns(true);
        await staking.stake(toBeDeposited);
        await staking.unstake(toBeDeposited);

        var maturing = await staking.getReleasingTimestamp(
            await signer.getAddress()
        );

        expect(
            maturing,
            "releasing timestamp should be bigger than now"
        ).to.be.above(now);
    });

    it("releasing balance getter", async () => {
        let toBeDeposited = 5;

        expect(
            await staking.getReleasingBalance(await signer.getAddress()),
            "realeasing balance should be 0"
        ).to.equal(0);

        await mockToken.mock.transferFrom.returns(true);
        await staking.stake(2 * toBeDeposited);
        await staking.unstake(toBeDeposited);

        expect(
            await staking.getReleasingBalance(await signer.getAddress()),
            "realeasing balance should be toBeDeposit"
        ).to.equal(toBeDeposited);

        await staking.unstake(toBeDeposited);

        expect(
            await staking.getReleasingBalance(await signer.getAddress()),
            "realeasing balance should be 2 * toBeDeposit"
        ).to.equal(2 * toBeDeposited);

        await advanceTime(signer.provider, MATURATION);
        await advanceBlock(signer.provider);

        await mockToken.mock.transfer.returns(true);

        await staking.withdraw(toBeDeposited);

        expect(
            await staking.getReleasingBalance(await signer.getAddress()),
            "realeasing balance should be toBeDeposit after first withdraw"
        ).to.equal(toBeDeposited);

        await mockToken.mock.transfer.returns(true);

        await staking.withdraw(toBeDeposited);

        expect(
            await staking.getReleasingBalance(await signer.getAddress()),
            "realeasing balance should be 0 after first withdraw"
        ).to.equal(0);
    });
});
