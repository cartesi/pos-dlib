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
import { MockContract } from "@ethereum-waffle/mock-contract";
import { solidity, MockProvider } from "ethereum-waffle";

import { BlockSelector } from "../src/types/BlockSelector";
import { BlockSelector__factory } from "../src/types/factories/BlockSelector__factory";
import { BigNumberish, Signer } from "ethers";

const { advanceTime, advanceBlock } = require("./utils");

use(solidity);

describe("BlockSelector", async () => {
    let signer: Signer;
    let alice: Signer;

    let blockSelector: BlockSelector;

    let minDiff = 100;
    let initialDiff = 1000000000;
    let diffAdjust = 50000;
    let targetInterval = 60 * 10; //10 minutes

    beforeEach(async () => {
        //await deployments.fixture();

        [signer, alice] = await ethers.getSigners();
        const blockSelectorFactory = new BlockSelector__factory(signer);
        blockSelector = await blockSelectorFactory.deploy();
    });

    it("instantiate should activate the instance", async () => {
        expect(
            await blockSelector.isActive(0),
            "first instance should be inactive before instantiate call"
        ).to.equal(false);

        await blockSelector.instantiate(
            minDiff,
            initialDiff,
            diffAdjust,
            targetInterval,
            await signer.getAddress()
        );

        expect(
            await blockSelector.isActive(0),
            "first instance should be active after instantiate call"
        ).to.equal(true);

        expect(
            await blockSelector.isActive(1),
            "second instance should not be active before instantiate call"
        ).to.equal(false);

        await blockSelector.instantiate(
            minDiff,
            initialDiff,
            diffAdjust,
            targetInterval,
            await signer.getAddress()
        );

        expect(
            await blockSelector.isActive(0),
            "first instance should be active after instantiate call"
        ).to.equal(true);

        expect(
            await blockSelector.isActive(1),
            "second instance should be active after instantiate call"
        ).to.equal(true);
    });

    it("produce block reverts if weight is zero", async () => {
        await blockSelector.instantiate(
            minDiff,
            initialDiff,
            diffAdjust,
            targetInterval,
            await signer.getAddress()
        );

        // advance blocks so the target is set
        await advanceBlock(signer.provider);
        await advanceBlock(signer.provider);

        await expect(
            blockSelector.produceBlock(0, await signer.getAddress(), 0),
            "weight should be bigger than zero"
        ).to.be.revertedWith(
            "Caller can't have zero staked tokens"
        );
    });

    it("produce block can only be called by operator address", async () => {
        await blockSelector.instantiate(
            minDiff,
            initialDiff,
            diffAdjust,
            targetInterval,
            await alice.getAddress()
        );

        // advance blocks so the target is set
        await advanceBlock(signer.provider);
        await advanceBlock(signer.provider);

        await expect(
            blockSelector.produceBlock(0, await signer.getAddress(), 50),
            "function wasn't called by operator address"
        ).to.be.revertedWith(
            "Function can only be called by pos address"
        );
    });
    it("instantiate should revert if target interval is too small", async () => {
        await expect(
            blockSelector.instantiate(
                minDiff,
                initialDiff,
                diffAdjust,
                20,
                await signer.getAddress()
            ),
            "target interval is less than 30 seconds (20 seconds)"
        ).to.be.revertedWith(
            "Target interval has to be bigger than 30 seconds"
        );
    });

    it("the amount of addresses eligible should increase over time", async () => {
        const provider = new MockProvider();
        let wallets = provider.getWallets();
        let weigth = 500000;
        let initialCount = 0;
        let midwayCount = 0;
        let finalCount = 0;

        await blockSelector.instantiate(
            minDiff,
            initialDiff,
            diffAdjust,
            targetInterval,
            await signer.getAddress()
        );

        // advance blocks so the target is set
        await advanceBlock(signer.provider);
        await advanceBlock(signer.provider);

        for (var wallet of wallets) {
            var address = await wallet.getAddress();
            if (await blockSelector.canProduceBlock(0, address, weigth)) {
                initialCount++;
            }
        }

        await advanceTime(signer.provider, 60 * 30); //30 minutes
        await advanceBlock(signer.provider);

        for (var wallet of wallets) {
            var address = await wallet.getAddress();
            if (await blockSelector.canProduceBlock(0, address, weigth)) {
                midwayCount++;
            }
        }

        await advanceTime(signer.provider, 60 * 60); // 60 minutes
        await advanceBlock(signer.provider);

        for (var wallet of wallets) {
            var address = await wallet.getAddress();
            if (await blockSelector.canProduceBlock(0, address, weigth)) {
                finalCount++;
            }
        }

        expect(
            initialCount,
            "initial count should be less than midway count"
        ).to.below(midwayCount);
        expect(
            midwayCount,
            "midway count should be less than final count"
        ).to.below(finalCount);
    });

    it("the weight variable should increase chance of producing a block", async () => {
        const provider = new MockProvider();
        let wallets = provider.getWallets();
        let lowWeightCount = 0;
        let highWeightCount = 0;
        let mediumWeightCount = 0;
        let lowWeight = 1;
        let mediumWeight = 500000000;
        let highWeight = 500000000000000;

        await blockSelector.instantiate(
            minDiff,
            initialDiff,
            diffAdjust,
            targetInterval,
            await signer.getAddress()
        );

        // advance blocks so the target is set
        await advanceBlock(signer.provider);
        await advanceBlock(signer.provider);

        for (var wallet of wallets) {
            var address = await wallet.getAddress();
            if (await blockSelector.canProduceBlock(0, address, lowWeight)) {
                lowWeightCount++;
            }

            if (await blockSelector.canProduceBlock(0, address, mediumWeight)) {
                mediumWeightCount++;
            }
            if (await blockSelector.canProduceBlock(0, address, highWeight)) {
                highWeightCount++;
            }
        }
        expect(
            lowWeightCount,
            "low weight count should be less than medium weight count"
        ).to.below(mediumWeightCount);

        expect(
            mediumWeightCount,
            "medium weight count should be less than high weight count"
        ).to.below(highWeightCount);


    });

    // TODO: this test should also make sure that the diff is changing by adjustment param
    it("difficulty should adjust according to time passed", async () => {
        let address = await signer.getAddress();
        let highWeight = 1000000000000;
        await blockSelector.instantiate(
            minDiff,
            initialDiff,
            diffAdjust,
            targetInterval,
            address
        );

        let diff = (await blockSelector.getDifficulty(0)).toNumber();

        // advance blocks so the target is set
        await advanceBlock(signer.provider);
        await advanceBlock(signer.provider);

        expect(
            diff,
            "after instantiate difficulty should be equal do initial difficulty"
        ).to.equal(initialDiff);

        // weight is very high to ensure block gets produced
        await blockSelector.produceBlock(0, address, highWeight);

        diff = (await blockSelector.getDifficulty(0)).toNumber();
        
        expect(
            diff,
            "difficulty should increase if block was produced too quickly"
        ).to.greaterThan(initialDiff);

        await advanceTime(signer.provider, 31 * 60); // advance 31 minutes
        await advanceBlock(signer.provider);

        await blockSelector.produceBlock(0, address, highWeight);

        diff = (await blockSelector.getDifficulty(0)).toNumber();

        expect(
            diff,
            "difficulty should decrease if block took more than 30 mins to be produced"
        ).to.below(initialDiff);

        await advanceTime(signer.provider, 5 * 60); // advance 5 minutes
        await advanceBlock(signer.provider);

        await blockSelector.produceBlock(0, address, highWeight);

        await advanceTime(signer.provider, 5 * 60); // advance 5 minutes
        await advanceBlock(signer.provider);

        await blockSelector.produceBlock(0, address, highWeight);

        await advanceTime(signer.provider, 5 * 60); // advance 5 minutes
        await advanceBlock(signer.provider);

        await blockSelector.produceBlock(0, address, highWeight);

        diff = (await blockSelector.getDifficulty(0)).toNumber();

        expect(
            diff,
            "difficulty should increase after multiple blocks that were produced quickly"
        ).to.above(initialDiff);

    });

    it("producing block resets selection", async () => {
        let mediumWeight = 5000000;
        let address = await signer.getAddress();


        await blockSelector.instantiate(
            minDiff,
            initialDiff,
            diffAdjust,
            targetInterval,
            address
        );

        // advance blocks so the target is set
        await advanceBlock(signer.provider);
        await advanceBlock(signer.provider);

        // advance time so a block can definitely be produced
        await advanceTime(signer.provider, 24 * 60 * 60); // advance 1 day
        await advanceBlock(signer.provider);

        // produce a block
        await blockSelector.produceBlock(0, address, mediumWeight);

        // advance blocks so the target is set
        await advanceBlock(signer.provider);
        await advanceBlock(signer.provider);

        expect(
            await blockSelector.canProduceBlock(0, address, mediumWeight),
            "selection was reset, block shouldnt be produced"
        ).to.equal(false);
    });

});
