#! /bin/sh

echo "cleaning ..."
mkdir -p .data
rm -rf .utils
mkdir -p .utils
rm -rf node_modules

echo "downloading phantomjs ..."
cd .utils

rm -rf phantomjs
wget -qO- https://phantomjs.googlecode.com/files/phantomjs-1.9.1-linux-x86_64.tar.bz2 | tar -jxf -
mv phantomjs-1.9.1-linux-x86_64 phantomjs

cd ..

npm install

cd node_modules

git clone git@github.com:trupin/solidify.git
cd solidify
npm install

cd ..

git clone git@github.com:trupin/phantomjs-node.git
mv phantomjs-node phantom
cd phantom

npm install

