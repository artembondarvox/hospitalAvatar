require(Modules.Avatar);

VoxEngine.addEventListener(AppEvents.CallAlerting, (callAlertingEvent) => {
  const { call } = callAlertingEvent;
  const avatarConfig = {avatarId:'<AVATAR_ID>', extended: false, customData: {voice: true, callerId: call.callerid(), phone: call.callerid()}};
  const asrParameters = {
    model: ASRModelList.Tinkoff,
    profile: ASRProfileList.Tinkoff.ru_RU,
    phraseHints: [],
    singleUtterance: true,
    interimResults: true,
  };
  const ttsPlayerOptions = {
    language: VoiceList.Yandex.Neural.ru_RU_jane,
  };
  const onError = () => {
    Logger.write('ERROR!');
    call.hangup();
  }
  const onFinish = (ev) => {
    Logger.write(ev);
    call.hangup();
  }
  const voiceAvatar = VoximplantAvatar.createVoiceAvatar({
    call,
    asrEndOfPhraseDetectorTimeout: 3000,
    onErrorCallback: onError,
    onFinishCallback: onFinish,
    avatarConfig,
    asrParameters,
    ttsPlayerOptions
  });
  call.record();
});
