# ---- Build stage: compile the Spring Boot jar ----
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
# Warm the dependency cache so code changes don't re-download everything.
RUN mvn -q -B dependency:go-offline
COPY src ./src
RUN mvn -q -B -DskipTests package

# ---- Run stage: small JRE image ----
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
ENV PORT=8080
EXPOSE 8080
# JAVA_OPTS keeps memory small enough for free hosting tiers (512 MB).
ENV JAVA_OPTS="-Xmx300m -XX:+UseSerialGC -Djava.security.egd=file:/dev/./urandom"
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
