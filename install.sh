#! /bin/sh

mkdir -p .utils
cd .utils

rm -rf phantomjs
wget -qO- https://phantomjs.googlecode.com/files/phantomjs-1.9.1-linux-x86_64.tar.bz2 | tar -jxf -
mv phantomjs-1.9.1-linux-x86_64 phantomjs

rm -rf casperjs
wget -qO- https://github.com/n1k0/casperjs/archive/1.0.3.tar.gz | tar -zxf -
mv casperjs-1.0.3 casperjs