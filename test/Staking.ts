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

import { Staking } from "../src/types/Staking";
import { Signer } from "ethers";

const { advanceTime } = require("./utils");

const ctsiJSON = require("@cartesi/token/build/contracts/CartesiToken.json");

use(solidity);

describe("Staking", async () => {
    const INDEX = 0;
    const DAY = 86401; // day + 1 second

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
        const stakingFactory = await ethers.getContractFactory("Staking");
        const staking = await stakingFactory.deploy(ctsiAddress);
        await staking.deployed();
        return staking as Staking;
    };

    beforeEach(async () => {
        await deployments.fixture();

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
            staking.depositStake(INDEX, toBeDeposited),
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
        await staking.depositStake(INDEX, toBeDeposited);

        expect(
            await staking.getStakedBalance(INDEX, aliceAddress),
            "staked Balance should still be zero, deposit not finalized"
        ).to.equal(0);
    });

    it("finalize stake doesnt change staked balance, when there are no pending deposits", async () => {
        await staking.finalizeStakes(INDEX);
        expect(
            await staking.getStakedBalance(INDEX, await signer.getAddress()),
            "staked balance should still be zero, no deposits to be finalized"
        ).to.equal(0);
    });

    it("finalizeStake has no effect if deposit is not mature", async () => {
        let toBeDeposited = 5;
        // mock transfer from as true
        await mockToken.mock.transferFrom.returns(true);

        await staking.depositStake(INDEX, toBeDeposited);
        await staking.finalizeStakes(INDEX);

        expect(
            await staking.getStakedBalance(INDEX, await signer.getAddress()),
            "staked balance should still be zero, deposit hasnt matured"
        ).to.equal(0);
    });

    it("single deposit finalized should change balance", async () => {
        let toBeDeposited = 5;
        // mock transfer from as true
        await mockToken.mock.transferFrom.returns(true);

        await staking.depositStake(INDEX, toBeDeposited);

        await advanceTime(signer.provider, DAY * 5);

        await staking.finalizeStakes(INDEX);

        expect(
            await staking.getStakedBalance(INDEX, await signer.getAddress()),
            "staked balance should match finalized deposit"
        ).to.equal(toBeDeposited);
    });
    it("multiple deposit can be finalized at once", async () => {
        let toBeDeposited = 5;
        // mock transfer from as true
        await mockToken.mock.transferFrom.returns(true);
        // test with multiple deposits

        await staking.depositStake(INDEX, toBeDeposited);
        await staking.depositStake(INDEX, toBeDeposited);
        await staking.depositStake(INDEX, toBeDeposited);

        await staking.finalizeStakes(INDEX);

        await advanceTime(signer.provider, DAY * 5);

        await staking.finalizeStakes(INDEX);
        expect(
            await staking.getStakedBalance(INDEX, await signer.getAddress()),
            "staked balance should include all 3 deposits"
        ).to.equal(3 * toBeDeposited);
    });

    it("withdraw should revert if there is not staked balance", async () => {
        let toBeWithdrew = 5;
        await expect(
            staking.startWithdraw(INDEX, toBeWithdrew),
            "withdraw start should revert if there is no staked balance"
        ).to.be.revertedWith("SafeMath: subtraction overflow");
    });

    it("withdraw should revert if deposits are not finalized", async () => {
        let toBeDeposited = 5;
        await mockToken.mock.transferFrom.returns(true);
        await staking.depositStake(INDEX, toBeDeposited);

        await expect(
            staking.startWithdraw(INDEX, toBeDeposited),
            "withdraw start should revert if there is no staked balance"
        ).to.be.revertedWith("SafeMath: subtraction overflow");
    });

    it("staked balance should diminish instantly", async () => {
        let toBeDeposited = 5;
        await mockToken.mock.transferFrom.returns(true);
        await staking.depositStake(INDEX, toBeDeposited);

        await advanceTime(signer.provider, DAY * 5);

        await staking.finalizeStakes(INDEX);
        await staking.startWithdraw(INDEX, toBeDeposited);

        expect(
            await staking.getStakedBalance(INDEX, await signer.getAddress()),
            "staked balance should diminish right after withdraw starts"
        ).to.equal(0);
    });

    it("finalize withdraws that are not mature, has no effect", async () => {
        let toBeDeposited = 5;
        await mockToken.mock.transferFrom.returns(true);
        await staking.depositStake(INDEX, toBeDeposited);

        await advanceTime(signer.provider, DAY * 5);

        await staking.finalizeStakes(INDEX);
        await staking.startWithdraw(INDEX, toBeDeposited);

        await expect(
            staking.finalizeWithdraws(INDEX),
            "Finalazing withdraw should emit event"
        )
            .to.not.emit(staking, "WithdrawFinalized")
    });

    it("finalize withdraws should trigger a transfer of tokens", async () => {
        let toBeDeposited = 5;
        await mockToken.mock.transferFrom.returns(true);
        await staking.depositStake(INDEX, toBeDeposited);

        await advanceTime(signer.provider, DAY * 5);

        await staking.finalizeStakes(INDEX);

        await mockToken.mock.transfer.returns(true);

        await staking.startWithdraw(INDEX, toBeDeposited);

        await advanceTime(signer.provider, DAY * 5);

        await expect(
            staking.finalizeWithdraws(INDEX),
            "Finalazing withdraw should emit event"
        )
            .to.emit(staking, "WithdrawFinalized")
            .withArgs(toBeDeposited, signer.getAddress);

    });

    it("finalize multiple withdraws should work", async () => {
        let toBeDeposited = 5;
        await mockToken.mock.transferFrom.returns(true);

        await staking.depositStake(INDEX, toBeDeposited);
        await staking.depositStake(INDEX, toBeDeposited);
        await staking.depositStake(INDEX, toBeDeposited);
        await staking.depositStake(INDEX, toBeDeposited);

        await advanceTime(signer.provider, DAY * 5);

        await staking.finalizeStakes(INDEX);

        expect(
            await staking.getStakedBalance(INDEX, await signer.getAddress()),
            "staked balance should equivalent to deposits"
        ).to.equal(toBeDeposited * 4);

        await mockToken.mock.transfer.returns(true);
        await staking.startWithdraw(INDEX, toBeDeposited);
        await staking.startWithdraw(INDEX, 2 * toBeDeposited);
        await staking.startWithdraw(INDEX, toBeDeposited);

        await advanceTime(signer.provider, DAY * 5);

        await expect(
            staking.finalizeWithdraws(INDEX),
            "Finalazing withdraw should emit event"
        )
            .to.emit(staking, "WithdrawFinalized")
            .withArgs(toBeDeposited * 4, signer.getAddress);

        expect(
            await staking.getStakedBalance(INDEX, await signer.getAddress()),
            "staked balance should be 0 after all withdraws are finalized"
        ).to.equal(0);
    });
});
