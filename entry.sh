#!/usr/bin/bash

npx hardhat node > node.log 2>&1 &
HARDHAT_NODE=$!
sleep 2
npx hardhat deploy --network local
head -n 40 node.log
sleep infinity
kill -2 $HARDHAT_NODE