import {
    BuidlerRuntimeEnvironment,
    DeployFunction,
} from "@nomiclabs/buidler/types";


const CTSI = require("@cartesi/token/build/contracts/CartesiToken.json");

const DAY = 86400; // seconds in a day

const func: DeployFunction = async (bre: BuidlerRuntimeEnvironment) => {
    const { deployments, getNamedAccounts, getChainId } = bre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const network_id = await getChainId();

    const CTSIAddress = CTSI.networks[network_id].address;

    await deploy("StakingImpl", {args: [CTSIAddress, 5 * DAY, 5 * DAY], from: deployer, log: true });
};

export default func;
export const tags = ['StakingImpl'];
