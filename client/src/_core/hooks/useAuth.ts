export function useAuth() {
  return {
    user: {
      id: 1,
      role: "admin",
      name: "Admin",
    },
    isAuthenticated: true,
  };
}
