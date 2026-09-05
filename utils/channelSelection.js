function getAnonymousPostTargetChannel(guild, preferredChannelId) {
  const cache = guild?.channels?.cache;

  if (preferredChannelId) {
    const preferred = cache?.get?.(preferredChannelId);
    if (preferred && preferred.isTextBased && preferred.name !== 'anonymous-reports') {
      return preferred;
    }
  }

  if (typeof cache?.find === 'function') {
    const found = cache.find((channel) => channel && channel.isTextBased && channel.name !== 'anonymous-reports' && channel.name.includes('anonymous'));
    if (found) {
      return found;
    }
  }

  const channels = cache?.values?.() || [];
  for (const channel of channels) {
    if (!channel || !channel.isTextBased) continue;
    if (channel.name === 'anonymous-reports') continue;
    if (channel.name.includes('anonymous')) {
      return channel;
    }
  }

  return null;
}

module.exports = {
  getAnonymousPostTargetChannel,
};
