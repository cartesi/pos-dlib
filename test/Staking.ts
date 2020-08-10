import { assert, expect, use } from "chai";
import {
    deployments,
    ethers,
    getNamedAccounts,
    getChainId,
} from "@nomiclabs/buidler";
import { solidity, MockProvider } from "ethereum-waffle";

import { Staking } from "../src/types/Staking";
import { Ierc20 } from "../src/types/Ierc20";
import { Signer, ContractFactory } from "ethers";

const { advanceTime } = require("./utils");

const CTSI = require("@cartesi/token/build/contracts/CartesiToken.json");

use(solidity);

describe("Staking", async () => {
    const INDEX = 0;
    const DAY = 86401; // day + 1 second

    let signer: Signer;

    let stakingAddress: string;
    let factory: ContractFactory;
    let ctsiFactory: ContractFactory;

    let instance: Staking;
    let ctsi: Ierc20;

    beforeEach(async () => {
        await deployments.fixture();
        const network_id = await getChainId();

        const CTSIAddress = CTSI.networks[network_id].address;

        [signer] = await ethers.getSigners();

        stakingAddress = (await deployments.get("Staking")).address;

        factory = await ethers.getContractFactory("Staking");
        ctsiFactory = await ethers.getContractFactory("Ierc20");
        instance = factory.connect(signer).attach(stakingAddress) as Staking;
        ctsi = ctsiFactory.connect(signer).attach(CTSIAddress) as Ierc20;
    });

    it("function depositStake()", async () => {
        const { alice } = await getNamedAccounts();
        let balance = await ctsi.balanceOf(alice);
        console.log(balance);

        ctsi.transfer(alice, 500000000);

        let currentBalance = await ctsi.balanceOf(alice);
        let toBeDeposited = 5;

        expect(
            await ctsi.balanceOf(stakingAddress),
            "staking contract should be instantiated with zero CTSI"
        ).to.equal(0);

        // Alice has to allow contract to act send tokens on her behalf
        await ctsi.increaseAllowance(stakingAddress, toBeDeposited);

        // TODO: this should check for events,
        // but contract is not emitting them yet
        await instance.depositStake(INDEX, toBeDeposited);

        expect(
            await ctsi.balanceOf(stakingAddress),
            "toBeDeposited should be transferred to staking contract"
        ).to.equal(toBeDeposited);

        expect(
            await instance.getStakedBalance(INDEX, alice),
            "staked Balance should still be zero, deposit not finalized"
        ).to.equal(0);
    });

    it("function finalizeStake()", async () => {
        const { alice } = await getNamedAccounts();
        let toBeDeposited = 5;

        // Alice has to allow contract to act send tokens on her behalf
        await ctsi.increaseAllowance(stakingAddress, 4 * toBeDeposited);

        await instance.finalizeStakes(INDEX);
        expect(
            await instance.getStakedBalance(INDEX, alice),
            "staked balance should still be zero, no deposits to be finalized"
        ).to.equal(0);
        await instance.depositStake(0, toBeDeposited);

        expect(
            await instance.getStakedBalance(INDEX, alice),
            "staked balance should still be zero, deposit not finalized"
        ).to.equal(0);

        await instance.finalizeStakes(INDEX);

        expect(
            await instance.getStakedBalance(INDEX, alice),
            "staked balance should still be zero, deposit hasnt matured"
        ).to.equal(0);

        // TODO: advance time here
        await instance.finalizeStakes(INDEX);

        expect(
            await instance.getStakedBalance(INDEX, alice),
            "staked balance should match finalized deposit"
        ).to.equal(toBeDeposited);

        // test with multiple deposits

        await instance.depositStake(INDEX, toBeDeposited);
        await instance.depositStake(INDEX, toBeDeposited);
        await instance.depositStake(INDEX, toBeDeposited);

        await instance.finalizeStakes(INDEX);

        expect(
            await instance.getStakedBalance(INDEX, alice),
            "staked balance should not include deposits that havent matured"
        ).to.equal(toBeDeposited);

        // TODO: advance time here
        await instance.finalizeStakes(INDEX);
        expect(
            await instance.getStakedBalance(INDEX, alice),
            "staked balance should include all 4 deposits"
        ).to.equal(4 * toBeDeposited);
    });

    it("function startWithdraw()", async () => {
        const { alice } = await getNamedAccounts();
        let toBeDeposited = 5;
        // Alice has to allow contract to act send tokens on her behalf
        await ctsi.increaseAllowance(stakingAddress, 5 * toBeDeposited);

        await expect(
            instance.startWithdraw(INDEX, toBeDeposited),
            "withdraw start should revert if there is no staked balance"
        ).to.be.revertedWith("SafeMath: subtraction overflow");

        await instance.depositStake(INDEX, toBeDeposited);

        let balanceAfterDeposit = await ctsi.balanceOf(alice);

        await expect(
            instance.startWithdraw(INDEX, toBeDeposited),
            "withdraw start should revert if there is no staked balance"
        ).to.be.revertedWith("SafeMath: subtraction overflow");

        // TODO: advance time here
        await instance.finalizeStakes(INDEX);

        expect(
            await instance.getStakedBalance(INDEX, alice),
            "staked balance should match finalized deposit"
        ).to.equal(toBeDeposited);

        await instance.startWithdraw(INDEX, toBeDeposited);

        expect(
            await instance.getStakedBalance(INDEX, alice),
            "staked balance should diminish right after withdraw starts"
        ).to.equal(0);

        expect(
            await ctsi.balanceOf(alice),
            "tokens should only return to alice after withdraw was finalized"
        ).to.equal(balanceAfterDeposit);

        await instance.finalizeWithdraws(INDEX);

        expect(
            await ctsi.balanceOf(alice),
            "withdraw finalization should only work after it matures"
        ).to.equal(balanceAfterDeposit);

        // TODO: advance time here
        await instance.finalizeWithdraws(INDEX);

        expect(
            await ctsi.balanceOf(alice),
            "tokens should return after a successful finalizeWithdraws()"
        ).to.greaterThan(balanceAfterDeposit);

        // test multiple withdraws

        await instance.depositStake(INDEX, toBeDeposited);
        await instance.depositStake(INDEX, toBeDeposited);
        await instance.depositStake(INDEX, toBeDeposited);
        await instance.depositStake(INDEX, toBeDeposited);
        // TODO: advance time here
        await instance.finalizeStakes(INDEX);

        expect(
            await instance.getStakedBalance(INDEX, alice),
            "staked balance should equivalent to deposits"
        ).to.equal(toBeDeposited * 4);

        await instance.startWithdraw(INDEX, toBeDeposited);
        await instance.startWithdraw(INDEX, 2 * toBeDeposited);
        await instance.startWithdraw(INDEX, toBeDeposited);

        // TODO: advance time here
        await instance.finalizeWithdraws(INDEX);

        expect(
            await instance.getStakedBalance(INDEX, alice),
            "staked balance should be 0 after all withdraws are finalized"
        ).to.equal(0);

        expect(
            await ctsi.balanceOf(stakingAddress),
            "there should be no money left on staking contract"
        ).to.equal(0);
    });
});
