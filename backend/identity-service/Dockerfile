FROM eclipse-temurin:21-jdk AS build
WORKDIR /workspace
COPY .mvn .mvn
COPY mvnw mvnw
COPY pom.xml pom.xml
COPY src src
RUN chmod +x mvnw && ./mvnw -q -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
RUN addgroup --system vector && adduser --system --ingroup vector vector
COPY --from=build /workspace/target/identity-service-0.0.1-SNAPSHOT.jar /app/identity-service.jar
USER vector
EXPOSE 8085
ENTRYPOINT ["java", "-jar", "/app/identity-service.jar"]
