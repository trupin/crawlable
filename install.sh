#! /bin/sh

echo "cleaning ..."
rm -rf .data
mkdir .data
rm -rf .utils
mkdir .utils

echo "downloading phantomjs ..."
cd .utils

rm -rf phantomjs
wget -qO- https://phantomjs.googlecode.com/files/phantomjs-1.9.1-linux-`uname -m`.tar.bz2 | tar -jxf -
mv phantomjs-1.9.1-linux-`uname -m` phantomjs

cd ..

cd node_modules
git clone git@github.com:trupin/solidify.git

cd solidify
npm install .

