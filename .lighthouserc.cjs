module.exports = {
  ci: {
    collect: {
      url: ["http://localhost:5173/"],
      numberOfRuns: 1,
    },
    upload: {
      target: "temporary-public-storage",
    },
  },
};
