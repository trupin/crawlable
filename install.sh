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

echo "downloading casperjs ..."
rm -rf casperjs
wget -qO- https://github.com/n1k0/casperjs/archive/1.0.3.tar.gz | tar -zxf -
mv casperjs-1.0.3 casperjs

cd ..

npm install

cd node_modules
git clone git@github.com:trupin/solidify.git
cd solidify
npm install