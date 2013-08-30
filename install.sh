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
