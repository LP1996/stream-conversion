#! /bin/sh

while true
do 
  procnum=` ps -ef|grep index.js |grep -v grep|wc -l`
  if [ $procnum -eq 0 ]; 
  then
    echo "restart... "$(date)
    cd /home/stream-conversion
    ./start.sh
  fi
  sleep 10
done
