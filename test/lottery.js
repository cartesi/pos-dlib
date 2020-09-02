//const contract = require("@truffle/contract");
//const BigNumber = require('bignumber.js');
//
//const Lottery = artifacts.require("Lottery");
//const PrizeManager = artifacts.require("PrizeManager");
//const PoS = artifacts.require("PoS");
//const CartesiToken = contract(require("@cartesi/token/build/contracts/CartesiToken.json"));
//
//module.exports = async (callback) => {
//    const networkId = await web3.eth.net.getId();
//    const accounts = await web3.eth.personal.getAccounts();
//
//    const contracts = [
//        CartesiToken
//    ];
//
//    contracts.forEach(contract => {
//        contract.setNetwork(networkId);
//        contract.setProvider(web3.currentProvider);
//        console.log(`${contract.contract_name} => ${contract.address}`);
//    });
//
//    let lottery = await Lottery.deployed();
//    let prizeManager = await PrizeManager.deployed(lottery.address, CartesiToken.address, 15000, 10000, {from: accounts[0]});
//
//    var index = await lottery.instantiate(10000, 50, prizeManager.address, prizeManager.address, {from: accounts[0]});
//
//    advanceBlock();
//
//
//    var allTrue = false;
//    while (!allTrue) {
//        allTrue = true;
//        for (var i = 0; i < accounts.length; i++) {
//            var can = await lottery.canWin(0, accounts[i], 500);
//
//            if (!can) {
//                allTrue = false;
//            }
//            console.log("account: " + i + "  - CAN WIN:  "+ can);
//        }
//
//        var block = await web3.eth.getBlock("latest");
//        console.log("timestamp: " + block.timestamp);
//        advanceTime(300);
//        advanceBlock();
//
//    }
//
//};
//
//advanceTime = (time) => {return new Promise((resolve, reject) => {web3.currentProvider.send({jsonrpc: '2.0',method: 'evm_increaseTime',params: [time],id: new Date().getTime()}, (err, result) => {if (err) { return reject(err) }return resolve(result)})})}
//
//advanceBlock = () => { return new Promise((resolve, reject) => { web3.currentProvider.send({ jsonrpc: '2.0', method: 'evm_mine', id: new Date().getTime() }, (err, result) => { if (err) { return reject(err) } const newBlockHash = web3.eth.getBlock('latest').hash; return resolve(newBlockHash) }) })}
//
//