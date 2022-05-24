const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const { request } = require('undici');

const PROTO_PATH_API = "./proto/session.proto";
const PROTO_PATH_AUTH = "./proto/auth.proto";

const options = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
};

const AvatarSession = grpc.loadPackageDefinition(protoLoader.loadSync(PROTO_PATH_API, options)).AvatarSession;
const AvatarAuth = grpc.loadPackageDefinition(protoLoader.loadSync(PROTO_PATH_AUTH, options)).Login;

function getRPCDeadline(rpcType) {
  timeAllowed = 5000
  switch(rpcType) {
      case 1:
          timeAllowed = 2000  // LIGHT RPC
          break

      case 2 :
          timeAllowed = 7000  // HEAVY RPC
          break
      default :
          console.log("Invalid RPC Type: Using Default Timeout")

  }
  return new Date( Date.now() + timeAllowed )
}

class Avatar {
  constructor (apiKey, accountId, avatarId) {
    this.apiKey = apiKey
    this.accountId = accountId
    this.avatarId = avatarId
  }

  async login() {
    const {statusCode, headers, trailers, body} = await request(`https://api.voximplant.com/platform_api/Logon?account_id=${this.accountId}&api_key=${this.apiKey}`);
    const resJson = await body.json();
    const {result, account_id, nlu_addresses} = resJson;
    const avatarHttpUrl = new URL(nlu_addresses[0]);
    const grpcEndpoint = avatarHttpUrl.host + ':443';

    this.authClient = new AvatarAuth(
      grpcEndpoint,
      grpc.credentials.createSsl()
    )
    this.sessionClient = new AvatarSession(
      grpcEndpoint,
      grpc.credentials.createSsl()
    )

    return new Promise(resolve => {
      this.authClient.Login({account_id: account_id.toString(), session_id: result}, (error, response) => {
        if (error) {
          resolve(false)
          return
        }
        this.token = response.jwt_token;
        console.log(`Logged in to ${grpcEndpoint} ${this.token}`)
        resolve(true);
      });
    });
  }

  async createSession(customData) {
    const sessionId = await this.__createSession(customData)
    if (sessionId === null) {
      // try to re-login
      await this.login()
      return await this.__createSession(customData)
    } else {
      return sessionId
    }
  }

  async terminateSession(sessionId) {
    await this.__terminateSession(sessionId)
  }

  async sendMessage(text, sessionId) {
    const response = await this.__sendMessage(text, sessionId)
    if (response === null) {
      // try to re-login
      await this.login()
      return await this.__sendMessage(text, sessionId)
    } else {
      return response
    }
  }

  async __createSession(customData) {
    return new Promise(resolve => {
      console.log('Start creating a session');
      let metadata = new grpc.Metadata();
      metadata.add('Authorization', 'Bearer ' + this.token);
      metadata.add('avatarId', this.avatarId);
      this.sessionClient.CreateSession({customData: JSON.stringify(customData)}, metadata, {deadline: getRPCDeadline(1)}, (error, response) => {
        if (error) {
          console.log(`ERROR: ${error}`)
          resolve(null);
          return;
        }
        resolve(response.sessionId);
      });
    });
  }

  async __terminateSession(sessionId) {
    return new Promise(resolve => {
      let metadata = new grpc.Metadata();
      metadata.add('Authorization', 'Bearer ' + this.token);
      metadata.add('avatarId', this.avatarId);
      this.sessionClient.TerminateSession({sessionId: sessionId}, metadata, {deadline: getRPCDeadline(1)}, (error, response) => {
        resolve()
      });
    });
  }

  async __sendMessage(text, sessionId) {
    return new Promise(resolve => {
      let finished = false

      console.log(`Send message ${text} to ${sessionId}`)
      let metadata = new grpc.Metadata();
      metadata.add('Authorization', 'Bearer ' + this.token);
      metadata.add('avatarId', this.avatarId);
      this.sessionClient.SendMessage({text, sessionId}, metadata, {deadline: getRPCDeadline(1)}, (error, response) => {
        if (!finished) {
          finished = true
          if (error) {
            console.log(`ERROR: ${error}`)
            resolve(null); 
            return
          }
          const customData = response.customData ? JSON.parse(response.customData) : {}
          resolve({utterance: response.utterance, isFinal: response.isFinal, customData: customData});
        }
      });

      setTimeout(() => {
        if (!finished) {
          const error = 'Timeout on send message to ${sessionId}'
          finished = true
          console.log(`ERROR: ${error}`)
          resolve(null)
        }
      }, 2500)
    });
  }
}

module.exports.Avatar = Avatar;
