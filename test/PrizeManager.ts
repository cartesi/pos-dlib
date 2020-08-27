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

import { PoSPrototype } from "../src/types/PoSPrototype";
import { PrizeManager } from "../src/types/PrizeManager";
import { Signer } from "ethers";
import { splitSignature } from "ethers/lib/utils";

const { advanceTime } = require("./utils");

const ctsiJSON = require("@cartesi/token/build/contracts/CartesiToken.json");
const posJSON = require("../build/contracts/PoSPrototype.json");

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
        numerator?: number;
        denominator?: number;
    } = {}): Promise<PrizeManager> => {
        const network_id = await getChainId();
        const posAddress =
            pos || posJSON.networks[network_id].address;
        const ctsiAddress = ctsi || ctsiJSON.networks[network_id].address;
        const prizeFactory = await ethers.getContractFactory("PrizeManager");
        const prizeManager = await prizeFactory.deploy(
            posAddress,
            ctsiAddress,
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
        mockToken = await deployMockContract(signer, ctsiJSON.abi);
        mockPoS = await deployMockContract(signer, posJSON.abi);
    });

    it("payWinner can only be called by PoS prototype", async () => {
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
            "function can only be called by pos address"
        ).to.be.revertedWith(
            "Only the pos contract can call this function"
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
