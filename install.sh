#! /bin/sh

echo "cleaning ..."
rm -rf .data
mkdir .data
rm -rf .utils
mkdir .utils

echo "downloading phantomjs ..."
cd .utils

rm -rf phantomjs

curl -s https://phantomjs.googlecode.com/files/phantomjs-1.9.1-linux-`uname -m`.tar.bz2 | tar -jxf -

mv phantomjs-1.9.1-linux-`uname -m` phantomjs

cd ..

cd node_modules

curl -sL https://github.com/trupin/solidify/archive/1.0.tar.gz | tar -xzf -
mv solidify-1.0 solidify

cd solidify
npm install .

