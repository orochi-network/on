#!/usr/bin/bash

npx hardhat node > /dev/null &
HARDHAT_NODE=$!
sleep 2
npx hardhat deploy --network local
sleep infinity
kill -2 $HARDHAT_NODE