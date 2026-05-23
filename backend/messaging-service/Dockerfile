FROM eclipse-temurin:21-jdk AS build
WORKDIR /workspace
COPY .mvn .mvn
COPY mvnw mvnw
COPY pom.xml pom.xml
RUN chmod +x mvnw
RUN ./mvnw -B -DskipTests dependency:go-offline
COPY src src
RUN ./mvnw -B -DskipTests clean package

FROM eclipse-temurin:21-jre
WORKDIR /app
RUN addgroup --system vector && adduser --system --ingroup vector vector
COPY --from=build /workspace/target/*.jar /app/app.jar
RUN chown -R vector:vector /app
USER vector
EXPOSE 8087
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
