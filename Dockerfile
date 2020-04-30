FROM streambase:1.0

RUN ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime

RUN mkdir /home/stream-conversion

WORKDIR /home/stream-conversion

COPY . .

RUN chmod +x autorestart.sh\
		&& chmod +x start.sh
RUN cat autorestart.sh
CMD ["nohup", "./autorestart.sh", "&"]