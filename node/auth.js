const { request } = require('undici');


async function getAuthToken(apiKey, accountId) {
  const {statusCode, headers, trailers, body} = await request(`https://api.voximplant.com/platform_api/Logon?account_id=${accountId}&api_key=${apiKey}`);
  const resJson = await body.json();
  const {result, account_id, nlu_addresses} = resJson;
  const avatarHttpUrl = new URL(nlu_addresses[0]);
  const avatarGrpcEndpoint = avatarHttpUrl.host + ':443';
  return {grpcEndpoint: avatarGrpcEndpoint, sessionToken: result}
}

module.exports.getAuthToken = getAuthToken;
