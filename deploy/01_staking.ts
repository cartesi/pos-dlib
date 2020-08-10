import {
    BuidlerRuntimeEnvironment,
    DeployFunction,
} from "@nomiclabs/buidler/types";


const CTSI = require("@cartesi/token/build/contracts/CartesiToken.json");

const func: DeployFunction = async (bre: BuidlerRuntimeEnvironment) => {
    const { deployments, getNamedAccounts, getChainId } = bre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const network_id = await getChainId();

    const CTSIAddress = CTSI.networks[network_id].address;

    await deploy("Staking", {args: [CTSIAddress], from: deployer, log: true });
};

export default func;
export const tags = ['Staking'];
