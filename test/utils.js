const { use } = require("chai");
const { solidity } = require("ethereum-waffle");

use(solidity);


const advanceTime = async (provider, seconds) => {
  await provider.send("evm_increaseTime", [seconds]);
};

const advanceBlock = async (provider) => {
  await provider.send("evm_mine");
};

const advanceMultipleBlocks = async (provider, numOfBlocks) => {
    for (let i = 0; i < numOfBlocks; i++) {
        await provider.send("evm_mine");
    }
};

module.exports = {
  advanceTime,
  advanceBlock,
  advanceMultipleBlocks
};
