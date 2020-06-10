/**
 * Truffle script to instantiate a Lottery.
 *
 * Usage:
 * truffle exec <script> --diff-adjustment <adjustment> --draw-interval <duration>
 */

const contract = require("@truffle/contract");
const program = require("commander");


const Staking = contract(require("./build/contracts/Staking.json"));
const PrizeManager = contract(require("./build/contracts/PrizeManager.json"));
const Lottery = contract(require("./build/contracts/Lottery.json"));

program
    .option('-n, --network <network>', 'Specify the network to use, using artifacts specific to that network. Network name must exist in the configuration')
    .option('-c, --compile', 'Compile contracts before executing the script')
    .option('-a, --account <account>', 'Account sender of transaction')
    .option('-da, --diff-adjustment <adjustment>', 'Specify the difficult adjustment parameter', 200)
    .option('-di, --draw-interval <duration>', 'Specify the desired duration of each draw, in seconds', 100)

module.exports = async (callback) => {

    program.parse(process.argv);
    console.log(`Creating a lottery with desired draw interval of ${program.drawInterval} seconds and difficulty adjustment parameter of ${program.diffAdjustment}`);

    try {
        const networkId = await web3.eth.net.getId();

        let fromAddress = undefined;
        if (program.account) {
            fromAddress = program.account;
        } else {
            const accounts = await web3.eth.personal.getAccounts();
            fromAddress = accounts[0];
        }

        const contracts = [
            Staking,
            PrizeManager,
            Lottery
        ];
        contracts.forEach(contract => {
            contract.setNetwork(networkId);
            contract.setProvider(web3.currentProvider);
            console.log(`${contract.contract_name} => ${contract.address}`);
        });

        const drawInterval = program.drawInterval;
        const diffAdjustment = program.diffAdjustment;

        const lottery = await Lottery.deployed();

        const transaction = await lottery.instantiate(
            diffAdjustment,
            drawInterval,
            Staking.address,
            PrizeManager.address,
            { from: fromAddress }
        );
        console.log(`Lottery created: ${transaction.tx}`);
        callback();

    } catch (e) {
        console.error(e);
        callback(e);
    }
};
