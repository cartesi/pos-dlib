import { assert, expect, use } from "chai";
import {
    deployments,
    ethers,
    getNamedAccounts,
    getChainId,
} from "@nomiclabs/buidler";
import {
    deployMockContract,
    MockContract,
} from "@ethereum-waffle/mock-contract";
import { solidity } from "ethereum-waffle";

import { Staking } from "../src/contracts/pos/Staking";
import { Signer } from "ethers";
import { splitSignature } from "ethers/lib/utils";

const { advanceTime } = require("./utils");

const ctsiJSON = require("@cartesi/token/build/contracts/CartesiToken.json");

use(solidity);

describe("Staking", async () => {
    const DAY = 86400; // seconds in a day
    const MATURATION = 5 * DAY + 1;

    let signer: Signer;
    let alice: Signer;
    let bob: Signer;

    let aliceAddress: string;

    let staking: Staking;
    let mockToken: MockContract;

    const deployStaking = async ({
        ctsi,
    }: {
        ctsi?: string;
    } = {}): Promise<Staking> => {
        const network_id = await getChainId();
        const ctsiAddress = ctsi || ctsiJSON.networks[network_id].address;
        const stakingFactory = await ethers.getContractFactory("StakingImpl");
        const staking = await stakingFactory.deploy(ctsiAddress, 5 * DAY, 5 * DAY);
        await staking.deployed();
        return staking as Staking;
    };

    beforeEach(async () => {
        //await deployments.fixture();

        [signer, alice, bob] = await ethers.getSigners();
        aliceAddress = await alice.getAddress();
        mockToken = await deployMockContract(signer, ctsiJSON.abi);

        staking = await deployStaking({ ctsi: mockToken.address });
    });

    it("deposit stake should emit event", async () => {
        let toBeDeposited = 5;
        let now = new Date();
        let unixTime = (now.getTime() / 1000).toFixed(0);

        let maturationDate = Number(unixTime) + DAY * 5;

        // mock transfer from as true
        await mockToken.mock.transferFrom.returns(true);

        // TODO: fix the event parameter for maturation date
        //       the date is a bit unreliable, because the block.timestamp varies
        await expect(
            staking.depositStake(toBeDeposited),
            "Deposting stake should emit event"
        ).to.emit(staking, "StakeDeposited");
        //.withArgs(
        //    toBeDeposited,
        //    signer.getAddress,
        //    maturationDate
        //);
    });

    it("deposit stake shouldnt change staked balance", async () => {
        let toBeDeposited = 5;
        // mock transfer from as true
        await mockToken.mock.transferFrom.returns(true);

        // await deposit
        await staking.depositStake(toBeDeposited);

        expect(
            await staking.getStakedBalance(aliceAddress),
            "staked Balance should still be zero, deposit not finalized"
        ).to.equal(0);
    });

    it("finalize stake reverts, when there are no mature pending deposits", async () => {
        let toBeDeposited = 5;
        // mock transfer from as true
        await mockToken.mock.transferFrom.returns(true);

        // await deposit
        await staking.depositStake(toBeDeposited);

        await expect(
            staking.finalizeStakes(),
            "not deposits ready to be staked"
        ).to.be.revertedWith("Deposits are not ready to be staked");

    });

    it("finalizeStake should revert if there is no amount to be staked", async () => {
        let toBeDeposited = 5;
        // mock transfer from as true
        await mockToken.mock.transferFrom.returns(true);

        await staking.depositStake(toBeDeposited);
        await advanceTime(signer.provider, MATURATION);
        await staking.finalizeStakes();

        await expect(
            staking.finalizeStakes(),
            "no tokens to become staked"
        ).to.be.revertedWith("No deposits to be staked");
    });

    it("single deposit finalized should change balance", async () => {
        let toBeDeposited = 5;
        // mock transfer from as true
        await mockToken.mock.transferFrom.returns(true);

        await staking.depositStake(toBeDeposited);

        await advanceTime(signer.provider, MATURATION);

        await staking.finalizeStakes();

        expect(
            await staking.getStakedBalance(await signer.getAddress()),
            "staked balance should match finalized deposit"
        ).to.equal(toBeDeposited);
    });

    it("new deposits should extend deadline", async () => {
        let toBeDeposited = 5;
        // mock transfer from as true
        await mockToken.mock.transferFrom.returns(true);

        await staking.depositStake(toBeDeposited);
        await advanceTime(signer.provider, MATURATION);
        await staking.depositStake(toBeDeposited);

        await expect(
            staking.finalizeStakes(),
            "not deposits ready to be staked"
        ).to.be.revertedWith("Deposits are not ready to be staked");

        await advanceTime(signer.provider, MATURATION);

        await staking.finalizeStakes();

        expect(
            await staking.getStakedBalance(await signer.getAddress()),
            "staked balance should match finalized deposit"
        ).to.equal(2 * toBeDeposited);

    });

    it("multiple deposit can be finalized at once", async () => {
        let toBeDeposited = 5;
        // mock transfer from as true
        await mockToken.mock.transferFrom.returns(true);
        // test with multiple deposits

        await staking.depositStake(toBeDeposited);
        await staking.depositStake(toBeDeposited);
        await staking.depositStake(toBeDeposited);

        await advanceTime(signer.provider, MATURATION);

        await staking.finalizeStakes();
        expect(
            await staking.getStakedBalance(await signer.getAddress()),
            "staked balance should include all 3 deposits"
        ).to.equal(3 * toBeDeposited);
    });

    it("withdraw should revert if there is not staked balance", async () => {
        let toBeWithdrew = 5;
        await expect(
            staking.startWithdraw(toBeWithdrew),
            "withdraw start should revert if there is no staked balance"
        ).to.be.revertedWith("SafeMath: subtraction overflow");
    });

    it("withdraw should revert if deposits are not finalized", async () => {
        let toBeDeposited = 5;
        await mockToken.mock.transferFrom.returns(true);
        await staking.depositStake(toBeDeposited);

        await expect(
            staking.startWithdraw(toBeDeposited),
            "withdraw start should revert if there is no staked balance"
        ).to.be.revertedWith("SafeMath: subtraction overflow");
    });

    it("staked balance should diminish instantly", async () => {
        let toBeDeposited = 5;
        await mockToken.mock.transferFrom.returns(true);
        await staking.depositStake(toBeDeposited);

        await advanceTime(signer.provider, MATURATION);

        await staking.finalizeStakes();
        await staking.startWithdraw(toBeDeposited);

        expect(
            await staking.getStakedBalance(await signer.getAddress()),
            "staked balance should diminish right after withdraw starts"
        ).to.equal(0);
    });

    it("finalize withdraws should revert if theyre not mature", async () => {
        let toBeDeposited = 5;
        await mockToken.mock.transferFrom.returns(true);
        await staking.depositStake(toBeDeposited);

        await advanceTime(signer.provider, MATURATION);

        await staking.finalizeStakes();
        await staking.startWithdraw(toBeDeposited);

        await expect(
            staking.finalizeWithdraws(),
            "Withdraw is not mature yet"
        ).to.be.revertedWith("Withdraw is not ready to be finalized");
    });

    it("finalize withdraws should revert if amount is zero", async () => {
        let toBeDeposited = 5;
        await mockToken.mock.transferFrom.returns(true);
        await staking.depositStake(toBeDeposited);

        await advanceTime(signer.provider, MATURATION);

        await staking.finalizeStakes();

        await mockToken.mock.transfer.returns(true);

        await staking.startWithdraw(toBeDeposited);

        await advanceTime(signer.provider, MATURATION);

        await expect(
            staking.finalizeWithdraws(),
            "Finalizing withdraw should emit event"
        )
            .to.emit(staking, "WithdrawFinalized")
            .withArgs(toBeDeposited, signer.getAddress);

        await expect(
            staking.finalizeWithdraws(),
            "No withdraws to be finalized"
        ).to.be.revertedWith("No withdraws to be finalized");
    });

    it("new withdraws should extend maturation deadline", async () => {
        let toBeDeposited = 5;
        await mockToken.mock.transferFrom.returns(true);
        await staking.depositStake(2 * toBeDeposited);

        await advanceTime(signer.provider, MATURATION);

        await staking.finalizeStakes();

        await mockToken.mock.transfer.returns(true);

        await staking.startWithdraw(toBeDeposited);

        await advanceTime(signer.provider, MATURATION);

        await staking.startWithdraw(toBeDeposited);

        await expect(
            staking.finalizeWithdraws(),
            "Withdraw is not mature yet"
        ).to.be.revertedWith("Withdraw is not ready to be finalized");

        await advanceTime(signer.provider, MATURATION);

        await expect(
            staking.finalizeWithdraws(),
            "Finalizing withdraw should emit event"
        )
            .to.emit(staking, "WithdrawFinalized")
            .withArgs(toBeDeposited * 2, signer.getAddress);
    });

    it("finalize multiple withdraws should work", async () => {
        let toBeDeposited = 5;
        await mockToken.mock.transferFrom.returns(true);

        await staking.depositStake(toBeDeposited);
        await staking.depositStake(toBeDeposited);
        await staking.depositStake(toBeDeposited);
        await staking.depositStake(toBeDeposited);

        await advanceTime(signer.provider, MATURATION);

        await staking.finalizeStakes();

        expect(
            await staking.getStakedBalance(await signer.getAddress()),
            "staked balance should equivalent to deposits"
        ).to.equal(toBeDeposited * 4);

        await mockToken.mock.transfer.returns(true);
        await staking.startWithdraw(toBeDeposited);
        await staking.startWithdraw(2 * toBeDeposited);
        await staking.startWithdraw(toBeDeposited);

        await advanceTime(signer.provider, MATURATION);

        await expect(
            staking.finalizeWithdraws(),
            "Finalizing withdraw should emit event"
        )
            .to.emit(staking, "WithdrawFinalized")
            .withArgs(toBeDeposited * 4, signer.getAddress);

        expect(
            await staking.getStakedBalance(await signer.getAddress()),
            "staked balance should be 0 after all withdraws are finalized"
        ).to.equal(0);
    });
});
