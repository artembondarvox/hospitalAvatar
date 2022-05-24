# hospitalAvatar
This is a hospital avatar example


# Make it work
- Create an avatar and use code and data from **/avatar** folder to bootstrap it
- Create an app on a platform, create empty scenario, use code from **/platform** folder to setup scenario. Replace avatarId placeholder with your real avatar id. Attach phone number to the scenario.
- In **/node** folder write down your platform & telegram bot creditnails into **.env** file. then setup packages & test the integration by calling
```
npm install
npm start
```
And when you're ready for production you can start docker container by
```
docker build -t username/app .
docker run --restart always -d username/app

```