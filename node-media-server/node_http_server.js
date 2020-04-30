//
//  Created by Mingliang Chen on 17/8/1.
//  illuspas[a]gmail.com
//  Copyright (c) 2018 Nodemedia. All rights reserved.
//


const URL = require('url');
const Fs = require('fs');
const Http = require('http');
const Https = require('https');
const WebSocket = require('ws');
const Express = require('express');
const basicAuth = require('basic-auth-connect');
const NodeFlvSession = require('./node_flv_session');
const HTTP_PORT = 80;
const HTTPS_PORT = 443;
const HTTP_WEBROOT = './public';
const HTTP_MEDIAROOT = './media';
const Logger = require('./node_core_logger');
const context = require('./node_core_ctx');

const streamsRoute = require('./api/routes/streams');
const serverRoute = require('./api/routes/server');


class NodeHttpServer {
  constructor(config) {
    this.port = config.http.port = config.http.port ? config.http.port : HTTP_PORT;
    this.webroot = config.http.webroot = config.http.webroot ? config.http.webroot : HTTP_WEBROOT;
    this.mediaroot = config.http.mediaroot = config.http.mediaroot ? config.http.mediaroot : HTTP_MEDIAROOT;
    this.config = config;

    // self code
    const OwnServer = require(config.externalServerPath);
    this.externalServer = new OwnServer(context);

    let app = Express();

    app.use(Express.static(this.webroot));
    app.use(Express.static(this.mediaroot));

    // self code
    app.use(Express.static(config.hlsRoot));

    app.all(['*.m3u8', '*.ts', '*.mpd', '*.m4s', '*.mp4'], (req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', this.config.http.allow_origin);
      next();
    });

    app.all('*.flv', (req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', this.config.http.allow_origin);
      res.setHeader('Content-Type', 'video/x-flv');
      res.setHeader("Pragma", 'no-cache');
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", 'close');
      res.setHeader("Expires", '-1');
      if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'range');
        res.end();
      } else if (Fs.existsSync(this.mediaroot + req.url)) {
        res.setHeader('Access-Control-Expose-Headers', 'Content-Length');
        next();
      } else {
        req.nmsConnectionType = 'http';
        this.onConnect(req, res);
      }
    });



    if (this.config.auth && this.config.auth.api) {
      app.use('/api/*', basicAuth(this.config.auth.api_user, this.config.auth.api_pass));
    }
    app.use('/api/streams', streamsRoute(context));
    app.use('/api/server', serverRoute(context));

    // self code
    this.externalServer.setServerRoute(app);

    this.httpServer = Http.createServer(app);


    /**
     * ~ openssl genrsa -out privatekey.pem 1024
     * ~ openssl req -new -key privatekey.pem -out certrequest.csr
     * ~ openssl x509 -req -in certrequest.csr -signkey privatekey.pem -out certificate.pem
     */
    if (this.config.https) {
      let options = {
        key: Fs.readFileSync(this.config.https.key),
        cert: Fs.readFileSync(this.config.https.cert)
      };
      this.sport = config.https.port ? config.https.port : HTTPS_PORT;
      this.httpsServer = Https.createServer(options, app);
    }
  }

  run() {
    this.httpServer.listen(this.port, () => {
      Logger.log(`Node Media Http Server started on port: ${this.port}`);
    });

    this.httpServer.on('error', (e) => {
      Logger.error(`Node Media Http Server ${e}`);
    });

    this.httpServer.on('close', () => {
      Logger.log('Node Media Http Server Close.');
    });

    this.wsServer = new WebSocket.Server({ server: this.httpServer });

    // self code
    this.config.emitter.on('send', (data) => {
      const clients = this.wsServer.clients.values();
      for(let client of clients) {
        if(client.isGetData) {
          client.send( data );
        }
      }
    });

    const this_ = this;
    this.wsServer.on('connection', (ws, req) => {
      // self code
      console.log('connect-----', req);
      let urlInfo = URL.parse(req.url, true);
      if (urlInfo.pathname === '/data') {
        ws.isGetData = true;
        const data = this.config.pageInfo._getSessionsAsArray();
        ws.send( JSON.stringify(data) );
        return;
      } else if(urlInfo.pathname.indexOf('keepConnect') > -1) {
        this_.config.emitter.emit('clientConnect', req.connection.remoteAddress);
        ws.on('message', function(message) {
          this_.config.emitter.emit('clientMessage', req.connection.remoteAddress, message);
        });
        ws.on('close', function() {
          this_.config.emitter.emit('clientClose', req.connection.remoteAddress);
        })
        return;
      }
      req.nmsConnectionType = 'ws';
      this.onConnect(req, ws);
    });

    this.wsServer.on('listening', () => {
      Logger.log(`Node Media WebSocket Server started on port: ${this.port}`);
    });
    this.wsServer.on('error', (e) => {
      Logger.error(`Node Media WebSocket Server ${e}`);
    });

    if (this.httpsServer) {
      this.httpsServer.listen(this.sport, () => {
        Logger.log(`Node Media Https Server started on port: ${this.sport}`);
      });

      this.httpsServer.on('error', (e) => {
        Logger.error(`Node Media Https Server ${e}`);
      });

      this.httpsServer.on('close', () => {
        Logger.log('Node Media Https Server Close.');
      });

      this.wssServer = new WebSocket.Server({ server: this.httpsServer });

      this.wssServer.on('connection', (ws, req) => {
        req.nmsConnectionType = 'ws';
        this.onConnect(req, ws);
      });

      this.wssServer.on('listening', () => {
        Logger.log(`Node Media WebSocketSecure Server started on port: ${this.sport}`);
      });
      this.wssServer.on('error', (e) => {
        Logger.error(`Node Media WebSocketSecure Server ${e}`);
      });
    }

    context.nodeEvent.on('postPlay', (id, args) => {
      context.stat.accepted++;
    });

    context.nodeEvent.on('postPublish', (id, args) => {
      context.stat.accepted++;
    });


    context.nodeEvent.on('doneConnect', (id, args) => {
      let session = context.sessions.get(id);
      let socket = session instanceof NodeFlvSession ? session.req.socket : session.socket;
      context.stat.inbytes += socket.bytesRead;
      context.stat.outbytes += socket.bytesWritten;
    });
  }

  stop() {
    this.httpServer.close();
    if (this.httpsServer) {
      this.httpsServer.close();
    }
    context.sessions.forEach((session, id) => {
      if (session instanceof NodeFlvSession) {
        session.req.destroy();
        context.sessions.delete(id);
      }
    });
  }

  onConnect(req, res) {
    let session = new NodeFlvSession(this.config, req, res);
    session.run();

  }
}

module.exports = NodeHttpServer