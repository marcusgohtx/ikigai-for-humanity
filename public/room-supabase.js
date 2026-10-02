// Shared rooms navigate immediately after anonymous sign-in. In embedded
// browsers, the default cross-tab auth lock can remain held during that
// navigation and leave the room shell blank. These short-lived anonymous
// game sessions do not need cross-tab coordination.
(function () {
  const original = supabase.createClient.bind(supabase);
  supabase.createClient = (url, key, options = {}) => original(url, key, {
    ...options,
    auth: {
      ...(options.auth || {}),
      lock: async (_name, _acquireTimeout, callback) => callback()
    }
  });
}());
