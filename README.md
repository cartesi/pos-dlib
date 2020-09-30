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

In order for tokens to increase the chance of an user being selected they havet o be staked. That interaction is done through the StakingImpl.sol contract, which offer three main functions:

- `stake(uint256 amount)`, where an user can deposit CTSI tokens for them to be staked. Tokens deposit will count as staked balance after a maturation time.

- `unstake(uint256 amount)`, where an user can decide to remove their tokens from the staked balance, in order to withdraw them. The tokens unstaked are also, for security reasons, subject to a maturation period before withdrawal is allowed. Unstaked tokens are instantly removed from staked balance, even if theyre still stored inside the Staking contract.

- `withdraw(uint256 amount)`, to transfer mature unstaked tokens back to an user's wallet.

# PrizeManager

Users that get selected by the `Lottery.sol` contract, which implements the aforementioned selection process, are rewarded by the PrizeManager contract. This contract is responsible for calculating the correct prize in CTSI and also for transferring that to the selected address - which is informed by the PoS main contract.
The PrizeManager payout is defined by the total amount of money in it times the payout rate. Meaning that the prize paid per each draw diminishes slightly after every transfer.

# PoS

The PoS contract manages the interactions between the Staking, Lottery and PrizeManager. It is responsible for making sure permissioned calls are secure, instantiating the Lottery and guiding the PrizeManager on whom to transfer money to. It is also the main concern and the contract that will interact with the offchain part of this dlib.

# Running locally (private net)

```
yarn
npx buidler node --port 7545
docker-compose -f docker-compose-test.yml -p alice up
```

# Running locally (testnet)

```
yarn
docker build . -t cartesi/pos
INFURA_ID=<your_infura_id_here> CHAIN_NAME=ropsten CHAIN_ID=3 docker-compose up
```
