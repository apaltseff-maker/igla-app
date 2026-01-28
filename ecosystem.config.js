module.exports = {
  apps: [
    {
      name: 'atelier-dev',
      script: 'C:\\dev\\atelier-app\\start-dev.bat',
      interpreter: 'none',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development'
      }
    }
  ]
};
