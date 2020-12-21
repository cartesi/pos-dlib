# PoS DLib - Proof of Stake DLib

This repository will hold the main components to choose a random participant based on Proof of Stake, meaning that the probability to be chosen at random is proportional to the amount of tokens held by the participant.

# Selection process

Before introducing the method, let us lay down some notation and introduction.

For the first implementation we are using the hash of a future block as a source of randomness.
This has a disadvantage by allowing a miner of the main chain to influence the result of this toss, but this is clearly a minor effect as we are not using this for large rewards that would be comparable with those of the main-chain mining.
Also the retossing has a minor effect in the system, unlike cassino-style contracts.

The random selection process will be based on the following algorithm.
After the hash `H` of the block is available for random number generation, each participant in the Proof of Stake algorithm will be able to calculate (off-chain) a random time after which it will be able to claim to be the chosen one.
The first user to call such claim function is the one officially selected.
These random times being different for each user mitigates the problem of race conditions.

- We denote by `T_i` the time interval (counting from the last selection) after which the user `i` can claim to be the winner.
- We write `a_i` and `b_i` for the address and balance of user `i` respectively
- Let `H` denote the hash which will be used as source of randomness
- Let `Y_i = hash(a_i, H)`, which will be a random number specific to user `i`
- Finally we have a variable `difficulty` (which changes addaptively) and regulates the time between selections.

The main formula we use for regulating the system is the one determining `T_i`:

![equation](https://latex.codecogs.com/svg.latex?T_i%20%3A%3D%20%5Cfrac%7B%5Ctext%7Bdifficulty%7D%7D%7Bb_i%7D%20%5Cbig%28%20256%20-%20%5Clog%28Y_i%29%20%5Cbig%29)

Therefore, before allowing a user to claim to be the selected one, we should run:

```
require(b_i * timePassedMicroSeconds > difficulty * (256 - log(Y_i))
```
where `timePassedMicroSeconds` is the time since the last person was selected.

Note that we should multiply both sides of the above inequality by a large number (say one million) in order to avoid rounding errors (effectively simulating fixed point arithmetics).

It is not hard to see that `T_i` defined above has an exponential distribution with parameter `b_i/difficulty`.
More precisely

![equation](https://latex.codecogs.com/svg.latex?P%5BT_i%20%5Cgeq%20x%5D%20%3D%20P%20%5CBig%5B%20%5Cfrac%7BY_i%7D%7B2%5E%7B256%7D%7D%20%5Cleq%20%5Cexp%20%5CBig%5C%7B%20-%20%5Cfrac%7Bb_i%7D%7B%5Ctext%7Bdifficulty%7D%7D%20x%20%5CBig%5C%7D%20%5CBig%5D%20%3D%20%5Cexp%20%5CBig%5C%7B%20-%20%5Cfrac%7Bb_i%7D%7B%5Ctext%7Bdifficulty%7D%7D%20x%20%5CBig%5C%7D)

Observing that the `T_i`'s are independent of one another, their minimum `T = min{T_i}` is also an exponential random variable with parameter given by `b/difficulty`, where `b` is the total balance of all active stakers `b = sum(b_1, b_2...)`.
This means that the average time for a block to appear is given by `difficulty/b`, so in other words, everytime the actively staked balance of all users change by a factor, the difficulty has to adapt by the same amount in order to regulate the expected interval between selections.

# Staking

In order for tokens to increase the chance of a user being selected they have to be staked. That interaction is done through the StakingImpl.sol contract, which offers four main functions:

- `stake(uint256 _amount)`, where a user can deposit CTSI tokens for them to be staked. When new tokens get deposited or `staked` they are subject to the `timeToStake` delay.

- `unstake(uint256 _amount)`, where a user can decide to remove their tokens from the staked balance in order to withdraw them. The tokens unstaked are also, for security reasons, subject to a maturation period before withdrawal is allowed. Unstaked tokens are instantly removed from staked balance, even if theyre still stored inside the Staking contract. When unstaking, the priority is removing first the tokens stored in the `maturing mapping` and then removing the remaining tokens from the `staked balance`.

- `withdraw(uint256 _amount)`, to move tokens from the `releasing mapping` to the `msg.sender` account, if the tokens were in the `releasing mapping` for at least `timeToRelease` seconds.

- `getStakedBalance(address _userAddress)` returns the sum of tokens inside the `staking mapping` plus the tokens inside the `maturing mapping` (if those tokens have been there for more than `timeToStake`seconds).

## Unintuitive behaviour:
Tokens deposited will count as a staked balance after a maturation time. The function `stake(uint _amount)` checks if there are mature tokens to be staked. Being the case, it transforms them into staked balance and adds the new tokens to the `maturing mappping`, starting by the tokens already stored and available on the `releasing mapping`. If there are not enough tokens on the `releasing mapping` to cover the `_amount` sent as a parameter then `ERC20.transferFrom` will be called, sending the remaining tokens from `msg.sender` account to the `StakingImpl` contract. The tokens `staked` do not count as `stakedBalance` until they mature. The maturation period is defined when the contract is deployed.
If the last deposit has already matured (and is counted when `getStakedBalance` is called) it gets moved to the "staked bucket". If not, it's maturation gets reset - meaning that the entirety of tokens matured (the old ones plus the new ones) will mature at the same time in `timeToStake` seconds.
The same is true for the `unstake()` function - any tokens waiting to be released will have their deadlines reset if new tokens are added to the "withdraw bucket".
When unstaking the priority are tokens that are in the "maturing bucket" and then the ones in the already staked one. This behaviour was chosen because it is the one most helpful to the users, since their staked tokens might be generating revenue.

## Risks:
- Someone withdrawing more tokens than they deposited.
- Someone having more staked balanced than the amount of tokens they have deposited before `now - time to stake`.
- Someone withdrawing tokens without having to wait for `time to  release` seconds.
- Someone having tokens in the relase bucket that still count as staked tokens.

# Block Selector

The Block Selector contract manages the selection of an address every `targetInterval` seconds according to the weighted random selection [described above](#selection-process).

When the function `produceBlock()` is called, the contract check if the address sent as a parameter fits the current random weighted selection and, if it does, declares a block as produced by returning true. Every time a block is deemed produced, the private function `_blockProduced` is called, storing the address of the producer and starting a new selection proccess with an updated difficulty.

The new difficulty is defined by the `getNewDifficulty` method, which takes into account the difference between the target interval and the actual interval and adjusts the difficulty based on the `adjustmentParam`, defined on the `instantiate` function.

## Risks:
- Miner manipulation of random numbers. This is addressed when discussing the selection process.
- An address claiming the win many times recursively before the selection gets reset.
- The chance of being selected not being proportional to the amount of tokens staked (the `weight` variable).
- Splitting the stake between different addresses increasing the chance of one of those addresses being selected.
- The difficulty getting stuck and not adjusting properly.
- Stakers being able to manipulate the selection process interval to reward more often than on average `targetInterval` by colluding to add/remove stake.

# RewardManager

Users that get selected by the `BlockSelector.sol` contract, which implements the aforementioned selection process, are rewarded by the RewardManager contract. This contract is responsible for calculating the correct prize in CTSI and also for transferring that to the selected address - which is informed by the PoS main contract.

The contract suggests payments according to this rule:
reward = (contract_balance * distNumerator) / distDenominator;

If reward is bigger than `maxReward`, the contract pays `maxReward`.
If reward is smaller than `minReward`, the contract pays the `minReward`. Finally, If the reward is bigger than the contract's balance, it pays the balance.

The function `reward` can only be called by an `operator`, defined during the contract's deployment. The operator is supposed to be a smart contract (the pos contract), not an EOA.

## Unintuitive behaviour:
The `operator` has the right to "order" the `RewardManager` contract to send any amount of tokens to any address, by calling the `reward()` function. However, the operator is expected to always use the `getCurrentReward()` to decide the correct amount and act accordingly.

## Risks:
- `getCurrentReward()` function always reverting will lock the tokens forever.
- `getCurrentReward()` returning the wrong value will over-reward or under-reward the block producer.

# PoS
The PoS contract is the main concern when dealing with the Noether architecture, it manages the interactions between the Staking, BlockSelector and RewardManager. It is responsible for making sure permissioned calls are secure, instantiating the BlockSelector and guiding the RewardManager on whom to transfer money to. It is also the main concern and the contract that will interact with the offchain part of this dlib.

The contract instantiates a `BlockSelector` instance in order to control the weigthed random selection of addresses and uses the `RewardManager` contract to manage the transfer of rewards.

The worker, representing a user, will constantly check off-chain if the address they are representing has been selected and, if so, they'll call the `produceBlock()` function of PoS on their behalf.
The `produceBlock()` checks if the `msg.sender` is an authorized representant of the selected address and, if they are, rewards the owner of that worker according to the `rewardManager` current reward definition.
A user has the right to add a beneficiary, which often will be the worker representing them, if they're not running that worker themselves. A beneficiary is defined by the function `addBeneficiary`, which receives a `split` variable. The `split` defines the percentage of each reward dedicated to the user that will go to the beneficiary, according to the math: `reward * split / SPLIT_BASE`, where `SPLIT_BASE` is equal to `10000`.

# Risks:
- An unauthorized worker calling the `produceBlock()` function on behalf of a user.
- A user calling the `produceBlock()` function directly and not through a worker.
- The function `produceBlock()` being called multiple times in a row for the same selected address, without a reset on the selection.
- The reward amount being manipulated or the getCurrentReward() always reverting.
- Someone being able to add a beneficiary on behalf of someone else.
- The sum of splits (user_split + beneficiary_split) being different than 100%.
- The function `produceBlock()` always reverting and freezing the chain.

# Running on goerli testnet

All contracts in this project are already pre-deployed at several testnets including [goerli](https://goerli.etherscan.io), which is the one we are going to use in the section.

You will need:

- The mnemonic of a goerli account with at least 2 ETH in it. Use a goerli ETH faucet get funds;
- An [Infura](https://infura.io) application;
- Docker and docker-compose [installed](https://docs.docker.com/get-docker/)
- Node 12+ [installed](https://nodejs.org/en/download/)

In order to test the staking you will perform the following steps:

- Get fake CTSI from our goerli faucet;
- Allow the Staking contract to transfer CTSI on your behalf;
- Stake your tokens;
- Run a local node;
- Hire and authorize this node so you can start participating.

We provide several [hardhat](https://hardhat.org) scripts to perform each of this steps, which will be explained in the following sections.
All the scripts print out the hashes of the transactions they send to the blockchain.
We recommend you check the transactions on [etherscan](https://goerli.etherscan.io) to make sure they are properly mined.

Assuming you already cloned this repo to your machine, run the following commands:
```
yarn
export PROJECT_ID=<your_infura_project_id_here>
export MNEMONIC="your twelve words mnemonic"
```

## Fake goerli CTSI

The first step is to have CTSI in your goerli account.
You should ask Cartesi's team at Discord to send you some fake CTSI.

## Allowance

ERC20 requires you to allow the Staking contract to "spend" some of your CTSI.
You must set an allowance, by running the following command:

```
npx hardhat --network goerli ctsi:allow 100000000000000000000
```

This will set an allowance of 100 CTSI.

## Stake CTSI

The next step is to actually stake your tokens.
The following command will stake 100 CTSI to the Staking contract.

```
npx hardhat --network goerli pos:stake 100000000000000000000
```

At this point you can check your staked balance using the following command:

```
npx hardhat --network goerli pos:show
```

This should print out something like:

```
PoS address: 0x05e97d1d5A8D9c5ee50786f9AB7b7bB1B6b8223c
Staked balance of 0xA0ab8e67E71485792e6bD1Afb51E407B0548355e: 0.0 CTSI
Maturing balance of 0xA0ab8e67E71485792e6bD1Afb51E407B0548355e: 100.0 CTSI
Maturation date: Wed Sep 30 2020 17:38:42 GMT-0400 (Eastern Daylight Time)
Unstaked balance of 0xA0ab8e67E71485792e6bD1Afb51E407B0548355e: 0.0 CTSI
```

As explained in the sections above the staked tokens has a maturation period, which is set to 2 hours in this testnet deployment.
So you have to wait this period for it to be really considered as staked.

## Run a local node

Finally you need to run a local node, by running the following command:

```
docker-compose -f docker-compose-goerli.yml up
```

The worker node starts with a new empty wallet, and keeps polling the blockchain to see if any user wants to hire him.
You should see the following lines in your console:

```
dispatcher_1  | [2020-09-30T16:28:20Z INFO  configuration] Getting worker state
dispatcher_1  | [2020-09-30T16:28:20Z INFO  configuration] Worker state: Available
```

You must hire this node so it can actually starts working for you, and also authorize the Staking contract to accepts calls from your worker node on your behalf.

You can hire the node using the command below.
It needs an amount of ETH to cover its gas costs. For now we are trasferring 0.5 ETH.

```
npx hardhat --network goerli worker:hire
```

This should kickstart your node, making it accept the job and printing something like the line below, where `0xa0ab8e67e71485792e6bd1afb51e407b0548355e` is your account address.

```
dispatcher_1  | [2020-09-30T20:09:53Z INFO  configuration] Worker state: Owned(0xa0ab8e67e71485792e6bd1afb51e407b0548355e)
```

## Unstaking and withdrawing

You should leave your node running as much as possible to you have the possibility to be selected and get CTSI rewards.
If you do you can unstaking and withdraw the tokens back to your wallet, by running the following commands;

```
npx hardhat --network goerli pos:unstake 100000000000000000000
```

The unstaked balance have a maturation period of 2 hours. After this you can withdraw back to your wallet by running the following command:

```
npx hardhat --network goerli pos:withdraw 100000000000000000000
```

# Running on mainnet

You will need to install Docker and docker-compose by [following their instructions](https://docs.docker.com/get-docker/).

Then open a console and run the following command:

```
curl -fsSL https://raw.githubusercontent.com/cartesi/pos-dlib/master/docker-compose.yml | docker-compose -f - up
```

After running you should see in the console something like the information below:

```
        .
       / \
     /    \
\---/---\  /----\
\       X       \
 \----/  \---/---\
      \    / CARTESI
       \ /
        '
Creating new wallet...
Address: 0x498104a032B16D617E6d42E27C1339B9F4aeAc1E
```

Then browse to https://explorer.cartesi.io/staking and copy and paste the node address as seen above, and follow instructions in the application.
