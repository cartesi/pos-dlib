const { ethers } = require("@nomiclabs/buidler");
const { expect, use } = require("chai");
const { solidity } = require("ethereum-waffle");
const axios = require("axios");

use(solidity);


const advanceTime = async (provider, seconds) => {
  const payload = {
    method: "evm_increaseTime",
    params: [seconds],
    jsonrpc: "2.0",
    id: 0,
  };
  await axios.post(provider._buidlerProvider._url, payload);
};
module.exports = {
  advanceTime,
};