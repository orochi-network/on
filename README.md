# Orochi Network Token and Vesting Contract

The Orochi Network Token ($ON) and its vesting contract are designed to ensure transparent and fair distribution of tokens within its community and backers. The vesting contract facilitates a structured release of $ON tokens, aligning stakeholder incentives with the project's long-term success while preventing market manipulation through gradual distribution. This approach fosters confidence among investors and participants, ensuring clarity and security in the token allocation process

## Usage

Build the image

```txt
docker build  --progress plain --no-cache -t localnode:latest .

```

Start local RPC node

```txt
docker run --name localrpc -ti -p 8545:8545 --rm localnode
```

### Installation

```txt
yarn
```

### Test

```txt
yarn test
```

### Compile

```txt
yarn compile
```

### Deployment

For test environment, we are using U2U Tesnet.  
Make sure running installation & compile task above

#### Create master wallet

Run following command. After run this command, wait some seconds and input your password to encrypt the wallet passphrase. It will create a `salt.bin` file. Please keep this file safe to restore/ create your wallet.

```
npx hardhat create:wallet
```

#### Get deployer address for specific chain

Run this following command with your password created above.

```
npx hardhat get:account --network [networkName]
```

Then get faucet here: https://faucet.u2u.xyz/.

#### Deploy vesting contract. Make sure to edit `tgeTime` variables.

```
npx hardhat deploy:vesting --network [networkName]
```

#### Add vesting term for specific address.

Remember to edit `vestingTerm` configuration before running this task. Can only add versting term before `tgeTime`.

```
npx hardhat add:vesting --network [networkName]
```

#### Verify contract

```
npx hardhat verify --network [networkName] [contractAddress] [...args]
```

## License

This project is licensed under [Apache V2.0](./LICENSE)
