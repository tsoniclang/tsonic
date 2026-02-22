export function getSettings(): Record<string, unknown> {
  return {
    authentication_methods: {
      password: true,
      dev: true,
      "openid connect": false,
    },
  };
}
