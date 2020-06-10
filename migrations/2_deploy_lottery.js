const contract = require("@truffle/contract");

const Lottery = artifacts.require("Lottery");
const Staking = artifacts.require("Staking");
const PrizeManager = artifacts.require("PrizeManager");
const CartesiToken = contract(require("@cartesi/token/build/contracts/CartesiToken.json"));

module.exports = function(deployer) {
  deployer.then(async () => {
    var prize_numerator = 2;
    var prize_denominator = 10000;

    // The lottery pays prize_numerator/prize_denominator * PrizeManager_balance
    // for each round winner

    CartesiToken.setNetwork(deployer.network_id);

    await deployer.deploy(Lottery);
    await deployer.deploy(Staking, CartesiToken.address);

    await deployer.deploy(PrizeManager, Lottery.address, CartesiToken.address, prize_numerator, prize_denominator);
  });
};
