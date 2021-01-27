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
import { solidity, MockProvider } from "ethereum-waffle";

import { BlockSelector } from "../src/types/BlockSelector";
import { BlockSelector__factory } from "../src/types/factories/BlockSelector__factory";
import { BigNumberish, Signer } from "ethers";

const { advanceTime, advanceBlock, advanceMultipleBlocks } = require("./utils");

use(solidity);

describe("BlockSelector", async () => {
    let signer: Signer;
    let alice: Signer;

    let blockSelector: BlockSelector;

    let minDiff = 100;
    let initialDiff = 100;
    let diffAdjust = 50000;
    let targetInterval = 40; //40 blocks ~= 10 minutes

    beforeEach(async () => {
        await deployments.fixture();

        [signer, alice] = await ethers.getSigners();

        const bsAddress = (await deployments.get("BlockSelector")).address;
        blockSelector = BlockSelector__factory.connect(bsAddress, signer);
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
        ).to.be.revertedWith("Caller can't have zero staked tokens");
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
        ).to.be.revertedWith("Function can only be called by pos address");
    });

    it("the amount of addresses eligible should increase with mainchain blocks", async () => {
        const provider = new MockProvider();
        var address: any;
        let wallets = provider.getWallets();
        let weigth = 5000000;
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
            address = await wallet.getAddress();
            if (await blockSelector.canProduceBlock(0, address, weigth)) {
                initialCount++;
            }
        }

        await advanceMultipleBlocks(signer.provider, 20);

        for (var wallet of wallets) {
            address = await wallet.getAddress();
            if (await blockSelector.canProduceBlock(0, address, weigth)) {
                midwayCount++;
            }
        }

        await advanceMultipleBlocks(signer.provider, 120);

        for (var wallet of wallets) {
            address = await wallet.getAddress();
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
        let mediumWeight = 900000;
        let highWeight = 500000000000000;

        await blockSelector.instantiate(
            minDiff,
            initialDiff,
            diffAdjust,
            targetInterval,
            await signer.getAddress()
        );

        await advanceMultipleBlocks(signer.provider, 120);

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
    it("difficulty should adjust according to number of blocks passed", async () => {
        let address = await signer.getAddress();
        let highWeight = 100000000000000;
        await blockSelector.instantiate(
            minDiff,
            initialDiff,
            diffAdjust,
            targetInterval,
            address
        );

        var diff: BigNumberish = await blockSelector.getDifficulty(0);

        // advance blocks so the target is set
        await advanceBlock(signer.provider);
        await advanceBlock(signer.provider);

        expect(
            diff,
            "after instantiate difficulty should be equal do initial difficulty"
        ).to.equal(initialDiff);

        // weight is very high to ensure block gets produced
        await blockSelector.produceBlock(0, address, highWeight);

        var newDiff = await blockSelector.getDifficulty(0);

        expect(
            newDiff,
            "difficulty should increase if block was produced too quickly"
        ).to.be.above(initialDiff);

        await advanceMultipleBlocks(signer.provider, targetInterval + 5);

        await blockSelector.produceBlock(0, address, highWeight);

        diff = await blockSelector.getDifficulty(0);

        expect(
            diff,
            "difficulty should decrease if block took longer than target interval be produced"
        ).to.be.below(newDiff);

        await advanceMultipleBlocks(signer.provider, 20); // advance 20 blocks

        await blockSelector.produceBlock(0, address, highWeight);

        await advanceMultipleBlocks(signer.provider, 20); // advance 20 blocks

        await blockSelector.produceBlock(0, address, highWeight);

        await advanceMultipleBlocks(signer.provider, 20); // advance 20 blocks

        await blockSelector.produceBlock(0, address, highWeight);

        diff = await blockSelector.getDifficulty(0);

        expect(
            diff,
            "difficulty should increase after multiple blocks that were produced quickly"
        ).to.be.above(initialDiff);
    });

    it("every 256 blocks target should be updated", async () => {
        const provider = new MockProvider();
        let wallets = provider.getWallets();
        let mediumWeight = 900000;
        var initialTargetCount = 0;
        var falseUpdateTargetCount = 0;
        var updatedTargetCount = 0;

        await blockSelector.instantiate(
            minDiff,
            initialDiff,
            diffAdjust,
            targetInterval,
            await signer.getAddress()
        );

        await advanceMultipleBlocks(signer.provider, 256);

        for (var wallet of wallets) {
            var address = await wallet.getAddress();
            if (await blockSelector.canProduceBlock(0, address, mediumWeight)) {
                initialTargetCount++;
            }
        }

        await advanceMultipleBlocks(signer.provider, 1);

        // target shouldn't change, this is the edge case
        for (var wallet of wallets) {
            var address = await wallet.getAddress();
            if (await blockSelector.canProduceBlock(0, address, mediumWeight)) {
                falseUpdateTargetCount++;
            }
        }

        await advanceMultipleBlocks(signer.provider, 2);

        // total blocks advanced = 256 + 1 + 2, should trigger seed update
        for (var wallet of wallets) {
            var address = await wallet.getAddress();
            if (await blockSelector.canProduceBlock(0, address, mediumWeight)) {
                updatedTargetCount++;
            }
        }

        expect(
            initialTargetCount,
            "256 block advancement should mantain target"
        ).to.equal(falseUpdateTargetCount);

        expect(
            initialTargetCount,
            ">256 should update target and therefore statistically have different winners"
        ).to.not.equal(updatedTargetCount);

        await blockSelector.produceBlock(
            0,
            await signer.getAddress(),
            mediumWeight * 1000000
        ); // high weight to guarantee block will be produced

        await advanceMultipleBlocks(signer.provider, 512);

        for (var wallet of wallets) {
            var address = await wallet.getAddress();
            if (await blockSelector.canProduceBlock(0, address, mediumWeight)) {
                initialTargetCount++;
            }
        }

        await advanceMultipleBlocks(signer.provider, 1);

        // target shouldn't change, this is the edge case
        for (var wallet of wallets) {
            var address = await wallet.getAddress();
            if (await blockSelector.canProduceBlock(0, address, mediumWeight)) {
                falseUpdateTargetCount++;
            }
        }

        await advanceMultipleBlocks(signer.provider, 2);

        // total blocks advanced = 256 + 1 + 2, should trigger seed update
        for (var wallet of wallets) {
            var address = await wallet.getAddress();
            if (await blockSelector.canProduceBlock(0, address, mediumWeight)) {
                updatedTargetCount++;
            }
        }

        expect(
            initialTargetCount,
            "512 block advancement should mantain target"
        ).to.equal(falseUpdateTargetCount);

        expect(
            initialTargetCount,
            ">512 should update target and therefore statistically have different winners"
        ).to.not.equal(updatedTargetCount);
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
        await advanceMultipleBlocks(signer.provider, 1000);

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

    it("isConcerned should always return false", async () => {
        let address = await signer.getAddress();

        expect(
            await blockSelector.isConcerned(0, address),
            "user should never be concerned by blockselector"
        ).to.equal(false);

        await blockSelector.instantiate(
            minDiff,
            initialDiff,
            diffAdjust,
            targetInterval,
            address
        );
        expect(
            await blockSelector.isConcerned(0, address),
            "user should never be concerned by blockselector"
        ).to.equal(false);
    });

    it("getSubInstances should return empty", async () => {
        let address = await signer.getAddress();

        await blockSelector.instantiate(
            minDiff,
            initialDiff,
            diffAdjust,
            targetInterval,
            address
        );

        var subInstances = await blockSelector.getSubInstances(0, address);

        expect(subInstances[0].length).to.equal(0);
        expect(subInstances[1].length).to.equal(0);
    });

    it("getters should return expected values", async () => {
        let address = await signer.getAddress();
        let highWeight = 500000000000000;

        await blockSelector.instantiate(
            minDiff,
            initialDiff,
            diffAdjust,
            targetInterval,
            address
        );

        var blockCount = await blockSelector.getBlockCount(0);
        var difficulty = await blockSelector.getDifficulty(0);
        var minDifficulty = await blockSelector.getMinDifficulty(0);
        var adjustmentParam = await blockSelector.getDifficultyAdjustmentParameter(
            0
        );
        var gTargetInterval = await blockSelector.getTargetInterval(0);
        var blocksPassed = await blockSelector.getSelectionBlockDuration(0);

        expect(blockCount, "blockCount should start at zero").to.equal(0);
        expect(difficulty, "difficulty should start as initialDiffi").to.equal(
            initialDiff
        );
        expect(
            minDifficulty,
            "getMinDiff should return minimumDifficulty"
        ).to.equal(minDiff);
        expect(
            adjustmentParam,
            "getAdjustmentParam should return adjustment parameter"
        ).to.equal(diffAdjust);
        expect(
            gTargetInterval,
            "getTargetInterval should return target interval"
        ).to.equal(targetInterval);
        expect(blocksPassed, "blocks passed should start at zero").to.equal(0);

        // advance 200 blocks
        await advanceMultipleBlocks(signer.provider, 200);

        var sBlocksPassed = await blockSelector.getSelectionBlockDuration(0);

        expect(sBlocksPassed, "200 blocks should have passed").to.equal(200); //blocks
        // produce a block

        await blockSelector.produceBlock(0, address, highWeight);

        blockCount = await blockSelector.getBlockCount(0);

        expect(
            blockCount,
            "blockCount should be one after first block is created"
        ).to.be.equal(1);
    });
});
