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

# Contributing

Thank you for your interest in Cartesi! Head over to our [Contributing Guidelines](CONTRIBUTING.md) for instructions on how to sign our Contributors Agreement and get started with
Cartesi!

Please note we have a [Code of Conduct](CODE_OF_CONDUCT.md), please follow it in all your interactions with the project.

# Authors

* *Felipe Argento*
* *Danilo Tuler*

# License

The repository and all contributions are licensed under
[APACHE 2.0](https://www.apache.org/licenses/LICENSE-2.0). Please review our [LICENSE](LICENSE) file.
